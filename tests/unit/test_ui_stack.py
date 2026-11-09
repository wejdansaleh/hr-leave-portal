import aws_cdk as cdk
from aws_cdk.assertions import Match, Template

from hr_leave_portal.ui_hosting_stack import UiHostingStack
from hr_leave_portal.ui_stack import UiStack


def test_hosting_bucket_is_private_and_cloudfront_redirects_to_https():
    app = cdk.App()
    hosting = UiHostingStack(app, "Hosting")
    template = Template.from_stack(hosting)

    template.has_resource_properties(
        "AWS::S3::Bucket",
        {
            "PublicAccessBlockConfiguration": {
                "BlockPublicAcls": True,
                "BlockPublicPolicy": True,
                "IgnorePublicAcls": True,
                "RestrictPublicBuckets": True,
            }
        },
    )
    template.has_resource_properties(
        "AWS::CloudFront::Distribution",
        {
            "DistributionConfig": {
                "DefaultRootObject": "index.html",
                "DefaultCacheBehavior": Match.object_like(
                    {"ViewerProtocolPolicy": "redirect-to-https"}
                ),
            }
        },
    )
    template.resource_count_is("AWS::CloudFront::OriginAccessControl", 1)
    template.has_output("UiUrl", {})


def test_hosting_spa_fallback_for_403_and_404():
    app = cdk.App()
    template = Template.from_stack(UiHostingStack(app, "Hosting"))
    dist = list(template.find_resources("AWS::CloudFront::Distribution").values())[0]
    errors = dist["Properties"]["DistributionConfig"]["CustomErrorResponses"]
    by_code = {e["ErrorCode"]: e for e in errors}
    assert set(by_code) == {403, 404}
    for e in by_code.values():
        assert e["ResponsePagePath"] == "/index.html"
        assert e["ResponseCode"] == 200


def test_ui_stack_deploys_assets_and_config_to_hosting_bucket(tmp_path):
    (tmp_path / "index.html").write_text("<html></html>")
    app = cdk.App()
    hosting = UiHostingStack(app, "Hosting")
    ui = UiStack(
        app,
        "Ui",
        hosting=hosting,
        api_url="https://api.example/prod/",
        user_pool_id="pool-1",
        user_pool_client_id="client-1",
        agent_runtime_arn="arn:aws:bedrock-agentcore:us-east-1:111111111111:runtime/x",
        dist_path=str(tmp_path),
    )
    template = Template.from_stack(ui)

    deployments = template.find_resources("Custom::CDKBucketDeployment")
    assert len(deployments) == 1
    props = list(deployments.values())[0]["Properties"]
    assert props["DistributionPaths"] == ["/*"]
    assert "DistributionId" in props
    assert "DestinationBucketName" in props
    # Two sources: the dist asset and the generated config.json
    assert len(props["SourceObjectKeys"]) == 2
    assert len(props["SourceBucketNames"]) == 2



def test_hosting_adds_security_headers_and_enforces_ssl_on_the_bucket():
    app = cdk.App()
    hosting = UiHostingStack(app, "Hosting")
    template = Template.from_stack(hosting)

    template.has_resource_properties(
        "AWS::CloudFront::ResponseHeadersPolicy",
        {
            "ResponseHeadersPolicyConfig": {
                "SecurityHeadersConfig": Match.object_like(
                    {
                        "ContentTypeOptions": {"Override": True},
                        "FrameOptions": {"FrameOption": "DENY", "Override": True},
                        "StrictTransportSecurity": Match.object_like(
                            {"Override": True}
                        ),
                    }
                )
            }
        },
    )
    # enforce_ssl=True adds a bucket policy that denies non-TLS requests
    template.has_resource_properties(
        "AWS::S3::BucketPolicy",
        {
            "PolicyDocument": {
                "Statement": Match.array_with(
                    [
                        Match.object_like(
                            {
                                "Effect": "Deny",
                                "Condition": {
                                    "Bool": {"aws:SecureTransport": "false"}
                                },
                            }
                        )
                    ]
                )
            }
        },
    )
