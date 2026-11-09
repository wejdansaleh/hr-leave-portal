from aws_cdk import Stack, aws_s3_deployment as s3deploy
from constructs import Construct

from hr_leave_portal.ui_hosting_stack import UiHostingStack


class UiStack(Stack):
    """Publishes the built React app plus a runtime config.json.

    The config.json key names are a contract with the React app."""

    def __init__(
        self,
        scope: Construct,
        construct_id: str,
        *,
        hosting: UiHostingStack,
        api_url: str,
        user_pool_id: str,
        user_pool_client_id: str,
        agent_runtime_arn: str,
        dist_path: str = "ui/dist",
        **kwargs,
    ) -> None:
        super().__init__(scope, construct_id, **kwargs)

        s3deploy.BucketDeployment(
            self,
            "DeployUi",
            sources=[
                s3deploy.Source.asset(dist_path),
                s3deploy.Source.json_data(
                    "config.json",
                    {
                        "region": self.region,
                        "apiUrl": api_url,
                        "userPoolId": user_pool_id,
                        "userPoolClientId": user_pool_client_id,
                        "agentRuntimeArn": agent_runtime_arn,
                    },
                ),
            ],
            destination_bucket=hosting.bucket,
            distribution=hosting.distribution,
            distribution_paths=["/*"],
        )
