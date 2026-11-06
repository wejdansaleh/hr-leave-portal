import json
import os

import boto3
from strands import tool

##MODEL_ID = "global.anthropic.claude-sonnet-5"
MODEL_ID = "us.amazon.nova-2-lite-v1:0"

bedrock = boto3.client("bedrock-runtime")
sns = boto3.client("sns")

TOPIC_ARN = os.environ["HR_EMAIL_TOPIC_ARN"]


@tool
def generate_leave_email(
    employee_name: str, start_date: str, end_date: str, reason: str = ""
) -> str:
    """Generate a polite time-off request email addressed to the HR department.

    Use this tool when a user asks you to draft, write, or generate an email
    requesting leave on behalf of an employee.

    Args:
        employee_name: Full name of the employee requesting time off.
        start_date: First day of leave, formatted YYYY-MM-DD.
        end_date: Last day of leave, formatted YYYY-MM-DD.
        reason: Optional reason for the time-off request.
    """
    prompt = (
        "Write a short, polite email from an employee to the HR department "
        "requesting time off. Address it to the HR team. Use these details:\n"
        f"- Employee name: {employee_name}\n"
        f"- First day off: {start_date}\n"
        f"- Last day off: {end_date}\n"
        f"- Reason: {reason or 'not given'}\n\n"
        "Return only the email text, starting with a subject line."
    )


    response = bedrock.converse(
        modelId=MODEL_ID,
        messages=[
            {
                "role": "user",
                "content": [{"text": prompt}],
            }
        ],
        inferenceConfig={"maxTokens": 1000},
    )

    return response["output"]["message"]["content"][0]["text"]



@tool
def send_email_to_hr(subject: str, body: str) -> dict:
    """Send an email to the HR department by publishing it to the HR SNS topic.

    Use this tool when a user asks you to send an email you have drafted to HR.
    Anyone subscribed to the topic (for example an HR mailbox) receives it.

    Args:
        subject: The email subject line.
        body: The email body text.
    """
    response = sns.publish(TopicArn=TOPIC_ARN, Subject=subject, Message=body)
    return {"messageId": response["MessageId"]}