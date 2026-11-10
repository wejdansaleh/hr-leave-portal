import aws_cdk as cdk
import pytest
from aws_cdk.assertions import Match, Template

from hr_leave_portal.backend_stack import LAYER_ARN_PARAM, BackendStack


@pytest.fixture(scope="module")
def template():
    app = cdk.App()
    stack = BackendStack(app, "Backend")
    return Template.from_stack(stack)


def test_one_dynamodb_table_exists(template):
    template.resource_count_is("AWS::DynamoDB::Table", 1)


def test_table_has_pk_sk_string_key_schema_and_on_demand_billing(template):
    template.has_resource_properties(
        "AWS::DynamoDB::Table",
        {
            "KeySchema": [
                {"AttributeName": "PK", "KeyType": "HASH"},
                {"AttributeName": "SK", "KeyType": "RANGE"},
            ],
            "BillingMode": "PAY_PER_REQUEST",
            # Match.array_with: CDK also declares the GSI key attributes here.
            "AttributeDefinitions": Match.array_with(
                [
                    {"AttributeName": "PK", "AttributeType": "S"},
                    {"AttributeName": "SK", "AttributeType": "S"},
                ]
            ),
        },
    )


def test_table_has_gsi1_keyed_on_gsi1pk_and_gsi1sk(template):
    # The stack defines a GSI named GSI1 (not a ByStartDate LSI); this pins what is deployed.
    template.has_resource_properties(
        "AWS::DynamoDB::Table",
        {
            "GlobalSecondaryIndexes": [
                Match.object_like(
                    {
                        "IndexName": "GSI1",
                        "KeySchema": [
                            {"AttributeName": "GSI1PK", "KeyType": "HASH"},
                            {"AttributeName": "GSI1SK", "KeyType": "RANGE"},
                        ],
                    }
                )
            ]
        },
    )


def test_table_has_no_local_secondary_index(template):
    # Documents the current state: there is no ByStartDate LSI. Remove or flip this
    # test if an LSI is added (note: an LSI can only be created with a new table).
    template.has_resource_properties(
        "AWS::DynamoDB::Table", Match.not_(Match.object_like({"LocalSecondaryIndexes": Match.any_value()}))
    )


def test_api_lambda_has_active_xray_tracing(template):
    template.has_resource_properties(
        "AWS::Lambda::Function",
        {
            "Handler": "handler.lambda_handler",
            "TracingConfig": {"Mode": "Active"},
        },
    )


def test_api_lambda_has_exactly_one_layer_resolved_from_ssm(template):
    # The layer ARN comes from an SSM parameter, so the template holds a CFN parameter
    # reference ({"Ref": ...}) in Layers rather than a literal ARN.
    template.has_resource_properties(
        "AWS::Lambda::Function",
        {"Handler": "handler.lambda_handler", "Layers": [{"Ref": Match.string_like_regexp("^SsmParameterValue")}]},
    )
    # Confirm that reference points at the FastAPI layer parameter.
    template.has_parameter(
        "*",
        {"Type": "AWS::SSM::Parameter::Value<String>", "Default": LAYER_ARN_PARAM},
    )


def test_api_lambda_receives_table_name_and_powertools_settings(template):
    template.has_resource_properties(
        "AWS::Lambda::Function",
        {
            "Handler": "handler.lambda_handler",
            "Environment": {
                "Variables": Match.object_like(
                    {
                        "TABLE_NAME": {"Ref": Match.string_like_regexp("^HrTable")},
                        "POWERTOOLS_SERVICE_NAME": "hr-api",
                    }
                )
            },
        },
    )


def test_one_rest_api_exists(template):
    template.resource_count_is("AWS::ApiGateway::RestApi", 1)


def test_cognito_authorizer_is_attached_to_the_user_pool(template):
    template.resource_count_is("AWS::ApiGateway::Authorizer", 1)
    template.has_resource_properties(
        "AWS::ApiGateway::Authorizer",
        {
            "Type": "COGNITO_USER_POOLS",
            "IdentitySource": "method.request.header.Authorization",
            "ProviderARNs": [{"Fn::GetAtt": [Match.string_like_regexp("^HrUserPool"), "Arn"]}],
        },
    )


def test_every_non_preflight_method_defaults_to_the_cognito_authorizer(template):
    # default_method_options applies to every method CDK creates for the proxy API
    # (root ANY plus {proxy+} ANY). With no CORS origins configured there are no OPTIONS
    # methods, so every method must be COGNITO_USER_POOLS with an AuthorizerId.
    methods = template.find_resources("AWS::ApiGateway::Method")
    assert methods, "expected API methods"
    for method in methods.values():
        props = method["Properties"]
        assert props["AuthorizationType"] == "COGNITO_USER_POOLS"
        assert "AuthorizerId" in props
