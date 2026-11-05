
from aws_cdk import (
    CfnOutput,
    Duration,
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
        **kwargs,
    ) -> None:
        super().__init__(scope, construct_id, **kwargs)

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
        user_pool_client = self.user_pool.add_client(
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
            value=user_pool_client.user_pool_client_id,
        )
