# AWS Deployment

This deployment starts with the cheapest useful production-like shape:

- S3 private web bucket
- CloudFront distribution
- GitHub OIDC deploy role
- GitHub Actions build and deploy workflow

## 1. Pick Values

Recommended starting values:

- AWS region: `eu-north-1` for Finland/Nordics, or `eu-west-1` for broad EU support.
- stack name: `jotos-web`
- GitHub repository: `jotos`

## 2. Deploy The AWS Foundation

Run from this project folder:

```bash
aws cloudformation deploy \
  --stack-name jotos-web \
  --template-file infra/aws/cloudformation.yml \
  --capabilities CAPABILITY_NAMED_IAM \
  --parameter-overrides \
    ProjectName=jotos \
    GitHubOwner=YOUR_GITHUB_USER_OR_ORG \
    GitHubRepository=jotos \
    GitHubBranch=main
```

Then read outputs:

```bash
aws cloudformation describe-stacks \
  --stack-name jotos-web \
  --query "Stacks[0].Outputs"
```

## 3. Add GitHub Repository Variables

Add these GitHub Actions variables:

- `AWS_REGION`
- `AWS_DEPLOY_ROLE_ARN`
- `AWS_WEB_BUCKET`
- `AWS_CLOUDFRONT_DISTRIBUTION_ID`
- `VITE_MML_API_KEY` for the National Land Survey open WMTS and vector tile services
- `VITE_MML_MAASTO_WMTS_TEMPLATE` if you want to override the default MML terrain raster template
- `VITE_MML_TOPO_WMTS_TEMPLATE` if you want to override the default MML background raster template
- `VITE_MAASTO_PMTILES_URL` if you host a National Land Survey PMTiles basemap pack for `Maasto`
- `VITE_MAASTO_WMTS_TEMPLATE` if you want to point `Maasto` at a custom WMTS tile template

## 4. Push To Main

GitHub Actions will:

1. install dependencies
2. build the web app
3. sync `dist/` to S3
4. invalidate CloudFront

If `VITE_MAASTO_PMTILES_URL` is set, the `Maasto` basemap will load that hosted PMTiles pack through MapLibre's `pmtiles://` protocol. Use this for a self-hosted basemap built from National Land Survey of Finland open topographic data.

If you want live MML tiles instead, set `VITE_MML_API_KEY`. The app will then use the official National Land Survey WMTS templates for `Maasto` and `Topo`, or you can override them with `VITE_MML_MAASTO_WMTS_TEMPLATE` and `VITE_MML_TOPO_WMTS_TEMPLATE` if the service address changes.

## 5. Next AWS Resources

After the static web app is live:

- add an API Gateway + Lambda route API
- add S3 original GPS file storage
- add DynamoDB route metadata
- add EventBridge import jobs
- add budget alarms before public users arrive
