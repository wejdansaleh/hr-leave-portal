from aws_cdk import (
    Duration,
    Stack,
    aws_apigateway as apigw,
    aws_cloudwatch as cw,
    aws_lambda as lambda_,
)
from constructs import Construct


class DashboardStack(Stack):
    def __init__(
        self,
        scope: Construct,
        construct_id: str,
        api_function: lambda_.Function,
        api: apigw.RestApi,
        **kwargs) -> None:
        super().__init__(scope, construct_id, **kwargs)

        def hr_requests(request_type: str) -> cw.MathExpression:
            # Every point also carries user_id, so add up all users' series
            # for this request type into one line.
            return cw.MathExpression(
                expression=(
                    "SUM(SEARCH('{HR,hr_request_type,user_id} MetricName=\"HrRequests\" "
                    f"hr_request_type=\"{request_type}\"', 'Sum', 300))"
                ),
                period=Duration.minutes(5),
                label=request_type)

        dashboard = cw.Dashboard(
            self, "HrDashboard", dashboard_name="HR-API")

        dashboard.add_widgets(
            cw.GraphWidget(
                title="HR requests by type (custom metric)",
                left=[hr_requests("TimeOff"), hr_requests("BenefitsInquiry")],
                width=12),
            cw.GraphWidget(
                title="API Gateway",
                left=[api.metric_count(), api.metric_client_error(), api.metric_server_error()],
                right=[api.metric_latency()],
                width=12),
        )
        dashboard.add_widgets(
            cw.GraphWidget(
                title="Lambda invocations & errors",
                left=[api_function.metric_invocations(), api_function.metric_errors()],
                right=[api_function.metric_throttles()],
                width=12),
            cw.GraphWidget(
                title="Lambda duration (p50 / p99)",
                left=[
                    api_function.metric_duration(statistic="p50"),
                    api_function.metric_duration(statistic="p99"),
                ],
                width=12),
        )
        dashboard.add_widgets(
            cw.LogQueryWidget(
                title="Requests per route (Logs Insights)",
                log_group_names=[f"/aws/lambda/{api_function.function_name}"],
                view=cw.LogQueryVisualizationType.TABLE,
                query_lines=[
                    "fields path",
                    'filter message = "request received"',
                    "stats count(*) as requests by method, path",
                    "sort requests desc",
                ],
                width=24),
        )