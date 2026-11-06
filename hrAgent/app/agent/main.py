from functools import lru_cache

from strands import Agent, tool
from strands import Agent
from strands.agent.conversation_manager.null_conversation_manager import NullConversationManager
from bedrock_agentcore.runtime import BedrockAgentCoreApp
from model.load import load_model
from parse import parse_payload
from memory.session import get_memory_session_manager
from tools import email_tools, employee_tools, leave_tools

DEFAULT_SYSTEM_PROMPT = """
You are an HR assistant for the company's leave-management system. You help HR
staff look up employees, manage employee records, and track leave requests.

You have tools to:
- Create, look up, update, list, and delete employees.
- List employees hired within a date range.
- Record and list leave requests for an employee, optionally filtered by month.

Guidelines:
- Always use a tool to read or change data. Never guess or make up employee
  details, ids, dates, or leave records.
- Employee ids are short (8-character) strings. If you don't have an id, list
  employees first and match on name rather than assuming one.
- Dates are formatted YYYY-MM-DD. Month filters are formatted YYYY-MM. If a user
  gives a date in another format, convert it before calling a tool.
- Before deleting an employee or overwriting an existing record, confirm with
  the user, since these actions replace or remove data.
- When a lookup returns nothing, say so plainly instead of inventing a result.
- Keep replies short and factual. Summarize what a tool returned rather than
  dumping raw fields, but keep every value accurate.
- Only help with HR tasks this system supports. Decline unrelated requests.
"""


# Define a collection of tools used by the model
tools = [
    # Employee tools
    employee_tools.create_employee,
    employee_tools.save_employee,
    employee_tools.get_employee,
    employee_tools.list_employees,
    employee_tools.list_employees_by_hire_date,
    employee_tools.delete_employee,
    # Leave tools
    leave_tools.save_leave,
    leave_tools.list_leave,
    # Email tools
    email_tools.generate_leave_email,
    email_tools.send_email_to_hr,
]
# Define a simple function tool
@tool
def add_numbers(a: int, b: int) -> int:
    """Return the sum of two numbers"""
    return a + b

tools.append(add_numbers)

def _make_conversation_manager():
    return NullConversationManager()

@lru_cache(maxsize=128)
def _get_agent(session_id: str, actor_id: str) -> Agent:
    """Given a session_id and actor_id, return or construct the corresponding Strands agent.
    Note: caching helps avoid repeated identity fetches on non-bedrock model loads
    and supports in-memory session management for local dev."""
    return Agent(
        model=load_model(),
        session_manager=get_memory_session_manager(session_id, actor_id),
        conversation_manager=_make_conversation_manager(),
        system_prompt=DEFAULT_SYSTEM_PROMPT,
        tools=tools,
    )

def create_app():
    app = BedrockAgentCoreApp()
    log = app.logger

    @app.entrypoint
    async def invoke(payload, context):
        log.info("Invoking Agent.....")

        session_id = getattr(context, "session_id", None) or "default-session"
        prompt, actor_id = parse_payload(payload)

        log.info(f"Invoking with session_id={session_id} and actor_id={actor_id}")
        agent = _get_agent(session_id, actor_id)

        async for event in agent.stream_async(prompt):
            if not isinstance(event, dict) or "event" not in event:
                continue
            cbs = event["event"].get("contentBlockStart")
            if cbs is not None and not cbs.get("start"):
                continue
            yield event

    return app

app = create_app()
if __name__ == "__main__":
    app.run()
