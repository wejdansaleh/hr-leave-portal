#!/usr/bin/env python3
import sys
from pathlib import Path

import aws_cdk as cdk
from hr_leave_portal.agent_runtime_stack import AgentRuntimeStack
from hr_leave_portal.backend_stack import BackendStack
from hr_leave_portal.notification_stack import NotificationStack
from hr_leave_portal.state_machine_stack import StateMachineStack
from hr_leave_portal.ui_hosting_stack import UiHostingStack
from hr_leave_portal.ui_stack import UiStack
from hr_leave_portal.dashboard_stack import DashboardStack

app = cdk.App()

notifications = NotificationStack(app, "HrLeavePortalNotifications")
ui_hosting = UiHostingStack(app, "HrLeavePortalUiHosting")
backend = BackendStack(
    app,
    "HrLeavePortalBackend",
    allowed_origins=[ui_hosting.origin, "http://localhost:5173"],
)

state_machine = StateMachineStack(
    app,
    "HrLeavePortalStateMachine",
    hr_email_topic=notifications.hr_email_topic,
    api_function=backend.api_function
)

agent_runtime = AgentRuntimeStack(
    app,
    "HrLeavePortalAgentRuntime",
    table=backend.table,
    hr_email_topic=notifications.hr_email_topic,
    user_pool=backend.user_pool,
    user_pool_client=backend.user_pool_client
)

ui_dist = Path(__file__).resolve().parent / "ui" / "dist"
if ui_dist.is_dir():
    UiStack(
        app,
        "HrLeavePortalUi",
        hosting=ui_hosting,
        api_url=backend.api.url,
        user_pool_id=backend.user_pool.user_pool_id,
        user_pool_client_id=backend.user_pool_client.user_pool_client_id,
        agent_runtime_arn=agent_runtime.agent_runtime_arn,
        dist_path=str(ui_dist),
    )
else:
    print(
        "ui/dist is missing, so HrLeavePortalUi was skipped. "
        "Run `npm --prefix ui run build` first.",
        file=sys.stderr,
    )

DashboardStack(
    app, "HrLeavePortalDashboard", api_function=backend.api_function, api=backend.api
)
app.synth()
