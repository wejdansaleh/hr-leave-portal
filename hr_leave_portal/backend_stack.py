from typing import Sequence

from aws_cdk import (
    CfnOutput,
    Duration,
    Fn,
    RemovalPolicy,
    Stack,
    aws_apigateway as apigw,
    aws_cognito as cognito,
    aws_dynamodb as dynamodb,
    aws_lambda as lambda_,
    aws_ssm as ssm,
)
from constructs import Construct


LAYER_ARN_PARAM = "/hr-leave-portal/fastapi-layer-arn"


class BackendStack(Stack):
    def __init__(
        self,
        scope: Construct,
        construct_id: str,
        allowed_origins: Sequence[str] | None = None,
        **kwargs,
    ) -> None:
        super().__init__(scope, construct_id, **kwargs)
        origins = list(allowed_origins) if allowed_origins else None

        # DynamoDB table
        table = dynamodb.Table(
            self,
            "HrTable",
            partition_key=dynamodb.Attribute(
                name="PK",
                type=dynamodb.AttributeType.STRING,
            ),
            sort_key=dynamodb.Attribute(
                name="SK",
                type=dynamodb.AttributeType.STRING,
            ),
            billing_mode=dynamodb.BillingMode.PAY_PER_REQUEST,
            removal_policy=RemovalPolicy.DESTROY,
        )

        # Global Secondary Index
        table.add_global_secondary_index(
            index_name="GSI1",
            partition_key=dynamodb.Attribute(
                name="GSI1PK",
                type=dynamodb.AttributeType.STRING,
            ),
            sort_key=dynamodb.Attribute(
                name="GSI1SK",
                type=dynamodb.AttributeType.STRING,
            ),
        )

        # FastAPI Lambda layer
        fastapi_layer_arn = (
            ssm.StringParameter.value_for_string_parameter(
                self,
                LAYER_ARN_PARAM,
            )
        )

        fastapi_layer = (
            lambda_.LayerVersion.from_layer_version_arn(
                self,
                "FastApiLayer",
                layer_version_arn=fastapi_layer_arn,
            )
        )

        # API Lambda
        api_function = lambda_.Function(
            self,
            "ApiFunction",
            runtime=lambda_.Runtime.PYTHON_3_14,
            handler="handler.lambda_handler",
            code=lambda_.Code.from_asset(
                "api",
                exclude=["__pycache__", "*.pyc"],
            ),
            layers=[fastapi_layer],
            timeout=Duration.seconds(10),
            memory_size=512,
            environment={
                "TABLE_NAME": table.table_name,
            },
        )

        if origins:
            api_function.add_environment(
                "ALLOWED_ORIGINS", Fn.join(",", origins)
            )

        table.grant_read_write_data(api_function)
        

        # Expose Lambda to other stacks
        self.api_function = api_function
        self.table = table

        
        # Cognito User Pool
        self.user_pool = cognito.UserPool(
            self,
            "HrUserPool",
            self_sign_up_enabled=False,
            sign_in_aliases=cognito.SignInAliases(
                email=True,
            ),
            removal_policy=RemovalPolicy.DESTROY,
        )

        # Cognito app client
        self.user_pool_client = self.user_pool.add_client(
            "HrUserPoolClient",
            auth_flows=cognito.AuthFlow(
                user_password=True,
            ),
            generate_secret=False,
        )

        # Cognito Authorizer
        authorizer = apigw.CognitoUserPoolsAuthorizer(
            self,
            "HrAuthorizer",
            cognito_user_pools=[self.user_pool],
        )

        # API Gateway
        cors_headers = [
            "Authorization",
            "Content-Type",
            "X-Amz-Date",
            "X-Api-Key",
            "X-Amz-Security-Token",
        ]
        cors_kwargs = {}
        if origins:
            cors_kwargs["default_cors_preflight_options"] = apigw.CorsOptions(
                allow_origins=origins,
                allow_methods=apigw.Cors.ALL_METHODS,
                allow_headers=cors_headers,
                max_age=Duration.hours(1),
            )

        api = apigw.LambdaRestApi(
            self,
            "HrApi",
            handler=api_function,
            default_method_options=apigw.MethodOptions(
                authorizer=authorizer,
                authorization_type=(
                    apigw.AuthorizationType.COGNITO
                ),
            ),
            **cors_kwargs,
        )
        self.api = api

        if origins:
            gateway_headers = {
                "Access-Control-Allow-Origin": f"'{origins[0]}'",
                "Access-Control-Allow-Headers": "'" + ",".join(cors_headers) + "'",
                "Access-Control-Allow-Methods": "'" + ",".join(apigw.Cors.ALL_METHODS) + "'",
            }
            api.add_gateway_response(
                "Default4xx",
                type=apigw.ResponseType.DEFAULT_4_XX,
                response_headers=gateway_headers,
            )
            api.add_gateway_response(
                "Default5xx",
                type=apigw.ResponseType.DEFAULT_5_XX,
                response_headers=gateway_headers,
            )

        # Stack outputs
        CfnOutput(
            self,
            "ApiUrl",
            value=api.url,
        )

        CfnOutput(
            self,
            "TableName",
            value=table.table_name,
        )

        CfnOutput(
            self,
            "UserPoolId",
            value=self.user_pool.user_pool_id,
        )

        CfnOutput(
            self,
            "UserPoolClientId",
            value=self.user_pool_client.user_pool_client_id,
        )
