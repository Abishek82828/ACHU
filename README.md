<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Verdant Organic Personal Care Store

This repository contains the Verdant e-commerce app with recommendations and search personalization.

View the original AI Studio source app: https://ai.studio/apps/8e31b6bd-0b25-4574-aa94-591128ae9c05

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Run the app:
   `npm run dev`

## AWS SNS Integration

This project can publish SNS notifications for completed purchases.

1. Set environment variables (see `.env.example`):
   - `AWS_REGION`
   - `AWS_SNS_TOPIC_ARN`
2. Ensure your AWS credentials are available in the runtime environment.
3. Test SNS publish endpoint:
   - `POST /api/notifications/sns/test`

## Product Notifications (SMS + Email + Call)

Use the endpoint below to send multi-channel product notifications.

- `POST /api/notifications/product`

Request body example:

```json
{
   "customer_id": 9001,
   "product_id": 1,
   "channels": ["sms", "email", "call"],
   "message": "Your product is back in stock!"
}
```

Configuration:

- SMS: AWS SNS direct phone publish (`AWS_REGION`)
- SMS provider selection: `SMS_PROVIDER` = `auto` | `aws-sns` | `twilio`
- Twilio SMS (optional): `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_PHONE_NUMBER` or `TWILIO_MESSAGING_SERVICE_SID`
- Email: SMTP settings (`SMTP_HOST`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`) or SNS topic email subscription fallback
- Call: AWS Connect (`CONNECT_REGION`, `CONNECT_INSTANCE_ID`, `CONNECT_CONTACT_FLOW_ID`, `CONNECT_SOURCE_PHONE_NUMBER`) or Twilio (`TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_PHONE_NUMBER`)

Note: Some AISPL-linked AWS accounts cannot create Amazon Connect instances. If you see this error, use a standard AWS account for Connect or use the Twilio fallback for calls.

## Notification Full-Ready Check

Run this command while the server is running:

- `npm run notify:check`

It verifies:

- SNS topic publish health
- SMS channel invocation
- Email channel readiness and send status
- Call channel readiness and send status

Optional test overrides:

- `NOTIFY_TEST_EMAIL`
- `NOTIFY_TEST_PHONE`
- `APP_BASE_URL` (default `http://localhost:3000`)
