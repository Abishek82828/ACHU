import "dotenv/config";

const baseUrl = process.env.APP_BASE_URL || "http://localhost:3000";
const testEmail = process.env.NOTIFY_TEST_EMAIL || "abisachi002@gmail.com";
const testPhone = process.env.NOTIFY_TEST_PHONE || "+918148309298";

function hasEnv(name) {
  return Boolean(process.env[name] && String(process.env[name]).trim().length > 0);
}

async function checkTopicPublish() {
  try {
    const response = await fetch(`${baseUrl}/api/notifications/sns/test`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        subject: "Verdant Readiness Check",
        message: `Readiness test at ${new Date().toISOString()}`,
      }),
    });

    const data = await response.json();
    return {
      ok: response.ok,
      status: response.status,
      data,
    };
  } catch (error) {
    return {
      ok: false,
      status: 0,
      data: { error: error instanceof Error ? error.message : "request failed" },
    };
  }
}

async function checkSms() {
  try {
    const response = await fetch(`${baseUrl}/api/notifications/product`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        customer_id: 9001,
        product_id: 1,
        channels: ["sms"],
        phone_number: testPhone,
        message: "Verdant SMS readiness check",
      }),
    });

    const data = await response.json();
    return {
      ok: response.ok && data?.notification?.sms?.sent === true,
      status: response.status,
      data,
    };
  } catch (error) {
    return {
      ok: false,
      status: 0,
      data: { error: error instanceof Error ? error.message : "request failed" },
    };
  }
}

async function checkEmail() {
  try {
    const response = await fetch(`${baseUrl}/api/notifications/product`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        customer_id: 9001,
        product_id: 1,
        channels: ["email"],
        email: testEmail,
        message: "Verdant email readiness check",
        email_subject: "Verdant Email Readiness",
      }),
    });

    const data = await response.json();
    return {
      ok: response.ok && data?.notification?.email?.sent === true,
      status: response.status,
      data,
    };
  } catch (error) {
    return {
      ok: false,
      status: 0,
      data: { error: error instanceof Error ? error.message : "request failed" },
    };
  }
}

async function checkCall() {
  try {
    const response = await fetch(`${baseUrl}/api/notifications/product`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        customer_id: 9001,
        product_id: 1,
        channels: ["call"],
        call_number: testPhone,
        message: "Verdant call readiness check",
      }),
    });

    const data = await response.json();
    return {
      ok: response.ok && data?.notification?.call?.sent === true,
      status: response.status,
      data,
    };
  } catch (error) {
    return {
      ok: false,
      status: 0,
      data: { error: error instanceof Error ? error.message : "request failed" },
    };
  }
}

async function main() {
  const envStatus = {
    awsRegion: hasEnv("AWS_REGION") || hasEnv("AWS_DEFAULT_REGION"),
    snsTopicArn: hasEnv("AWS_SNS_TOPIC_ARN"),
    smtpReady: ["SMTP_HOST", "SMTP_USER", "SMTP_PASS", "SMTP_FROM"].every(hasEnv),
    twilioReady: ["TWILIO_ACCOUNT_SID", "TWILIO_AUTH_TOKEN", "TWILIO_PHONE_NUMBER"].every(hasEnv),
  };

  const [topic, sms, email, call] = await Promise.all([
    checkTopicPublish(),
    checkSms(),
    checkEmail(),
    checkCall(),
  ]);

  const summary = {
    baseUrl,
    testedAt: new Date().toISOString(),
    envStatus,
    checks: {
      topicPublish: topic,
      sms,
      email,
      call,
    },
  };

  console.log(JSON.stringify(summary, null, 2));
}

main().catch((error) => {
  console.error("Notification readiness check failed", error);
  process.exit(1);
});
