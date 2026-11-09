import aws_cdk as cdk
import pytest
from aws_cdk.assertions import Template

from hr_leave_portal.backend_stack import BackendStack

ORIGINS = ["https://example.cloudfront.net", "http://localhost:5173"]


@pytest.fixture(scope="module")
def template():
    app = cdk.App()
    stack = BackendStack(app, "Backend", allowed_origins=ORIGINS)
    return Template.from_stack(stack)


def _methods(template):
    return list(template.find_resources("AWS::ApiGateway::Method").values())


def test_preflight_is_unauthenticated_and_other_methods_use_cognito(template):
    methods = _methods(template)
    options = [m for m in methods if m["Properties"]["HttpMethod"] == "OPTIONS"]
    others = [m for m in methods if m["Properties"]["HttpMethod"] != "OPTIONS"]
    assert options, "expected OPTIONS methods from CORS preflight"
    assert others, "expected real API methods"
    for m in options:
        assert m["Properties"]["AuthorizationType"] == "NONE"
    for m in others:
        assert m["Properties"]["AuthorizationType"] == "COGNITO_USER_POOLS"
        assert "AuthorizerId" in m["Properties"]


def test_preflight_allows_only_configured_origin_set(template):
    # Preflight answers with the origin that matches the request, from the configured list.
    text = str(
        [
            m["Properties"]["Integration"]
            for m in _methods(template)
            if m["Properties"]["HttpMethod"] == "OPTIONS"
        ]
    )
    assert "https://example.cloudfront.net" in text
    assert "http://localhost:5173" in text
    assert "'*'" not in text


def test_gateway_error_responses_carry_cors_headers(template):
    responses = template.find_resources("AWS::ApiGateway::GatewayResponse")
    by_type = {r["Properties"]["ResponseType"]: r["Properties"] for r in responses.values()}
    assert {"DEFAULT_4XX", "DEFAULT_5XX"} <= set(by_type)
    for t in ("DEFAULT_4XX", "DEFAULT_5XX"):
        headers = by_type[t]["ResponseParameters"]
        assert headers["gatewayresponse.header.Access-Control-Allow-Origin"] == (
            "'https://example.cloudfront.net'"
        )
        assert "gatewayresponse.header.Access-Control-Allow-Headers" in headers


def test_lambda_receives_allowed_origins(template):
    fns = template.find_resources("AWS::Lambda::Function")
    envs = [
        f["Properties"].get("Environment", {}).get("Variables", {})
        for f in fns.values()
    ]
    assert any("ALLOWED_ORIGINS" in e for e in envs)
