import aws_cdk as cdk
from aws_cdk.assertions import Match, Template

from hr_leave_portal.backend_stack import BackendStack
from hr_leave_portal.notification_stack import NotificationStack


def test_notification_stack_has_one_topic_with_an_email_subscription():
    app = cdk.App()
    template = Template.from_stack(NotificationStack(app, "Notifications"))

    template.resource_count_is("AWS::SNS::Topic", 1)
    template.has_resource_properties("AWS::SNS::Subscription", {"Protocol": "email"})


def test_backend_table_is_pay_per_request_with_pk_sk_and_gsi1():
    app = cdk.App()
    template = Template.from_stack(BackendStack(app, "Backend"))

    template.has_resource_properties(
        "AWS::DynamoDB::Table",
        {
            "BillingMode": "PAY_PER_REQUEST",
            "KeySchema": [
                {"AttributeName": "PK", "KeyType": "HASH"},
                {"AttributeName": "SK", "KeyType": "RANGE"},
            ],
            "GlobalSecondaryIndexes": Match.array_with(
                [Match.object_like({"IndexName": "GSI1"})]
            ),
        },
    )


def test_backend_users_are_admin_created_and_can_sign_in_with_a_password():
    app = cdk.App()
    template = Template.from_stack(BackendStack(app, "Backend"))

    template.has_resource_properties(
        "AWS::Cognito::UserPool",
        {"AdminCreateUserConfig": {"AllowAdminCreateUserOnly": True}},
    )
    template.has_resource_properties(
        "AWS::Cognito::UserPoolClient",
        {"ExplicitAuthFlows": Match.array_with(["ALLOW_USER_PASSWORD_AUTH"])},
    )


def test_backend_api_methods_all_use_the_cognito_authorizer_without_cors_options():
    app = cdk.App()
    template = Template.from_stack(BackendStack(app, "Backend"))

    methods = [
        m["Properties"]
        for m in template.find_resources("AWS::ApiGateway::Method").values()
    ]
    assert methods, "expected API methods"
    # No allowed_origins given, so no CORS preflight (OPTIONS) methods are added.
    assert all(m["HttpMethod"] != "OPTIONS" for m in methods)
    assert all(m["AuthorizationType"] == "COGNITO_USER_POOLS" for m in methods)
