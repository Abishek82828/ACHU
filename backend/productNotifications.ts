import { ConnectClient, StartOutboundVoiceContactCommand } from "@aws-sdk/client-connect";
import nodemailer from "nodemailer";
import twilio from "twilio";
import { publishSmsToPhone, publishToSns, SnsPublishResult } from "./sns";

type ChannelName = "sms" | "email" | "call";

interface ChannelDeliveryResult {
  channel: ChannelName;
  attempted: boolean;
  sent: boolean;
  provider: "aws-sns" | "aws-sns-topic" | "smtp" | "twilio" | "aws-connect";
  messageId?: string;
  reason?: string;
  error?: string;
}

export interface ProductNotificationRequest {
  channels: ChannelName[];
  customerName?: string;
  productName?: string;
  productCategory?: string;
  message: string;
  smsTo?: string;
  emailTo?: string;
  callTo?: string;
  emailSubject?: string;
}

export interface ProductNotificationResponse {
  sms?: ChannelDeliveryResult;
  email?: ChannelDeliveryResult;
  call?: ChannelDeliveryResult;
}

function getSmsProvider(): "aws-sns" | "twilio" | "auto" {
  const raw = String(process.env.SMS_PROVIDER ?? "auto").trim().toLowerCase();
  if (raw === "aws-sns" || raw === "twilio") return raw;
  return "auto";
}

function buildEmailTransporter() {
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT ?? 587);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const secure = String(process.env.SMTP_SECURE ?? "false").toLowerCase() === "true";

  if (!host || !user || !pass) {
    return null;
  }

  return nodemailer.createTransport({
    host,
    port,
    secure,
    auth: {
      user,
      pass,
    },
  });
}

function getAwsRegion(): string | undefined {
  return process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION;
}

function getConnectRegion(): string | undefined {
  return process.env.CONNECT_REGION || getAwsRegion();
}

function buildCallTwiml(message: string): string {
  const safe = message
    .replace(/&/g, "and")
    .replace(/</g, "")
    .replace(/>/g, "")
    .replace(/"/g, "")
    .replace(/'/g, "");

  return `<Response><Say voice="alice">${safe}</Say></Response>`;
}

async function sendSms(message: string, to?: string): Promise<ChannelDeliveryResult> {
  if (!to) {
    return {
      channel: "sms",
      attempted: false,
      sent: false,
      provider: "aws-sns",
      reason: "No SMS recipient phone number provided",
    };
  }

  const provider = getSmsProvider();

  if (provider === "twilio") {
    return sendSmsWithTwilio(message, to);
  }

  if (provider === "aws-sns") {
    return sendSmsWithSns(message, to);
  }

  const snsResult = await sendSmsWithSns(message, to);
  if (snsResult.sent) {
    return snsResult;
  }

  const twilioResult = await sendSmsWithTwilio(message, to);
  if (twilioResult.sent || twilioResult.attempted) {
    if (!twilioResult.sent && snsResult.reason) {
      twilioResult.reason = twilioResult.reason
        ? `SNS fallback failed: ${snsResult.reason}. ${twilioResult.reason}`
        : `SNS fallback failed: ${snsResult.reason}`;
    }
    return twilioResult;
  }

  return snsResult;
}

async function sendSmsWithSns(message: string, to: string): Promise<ChannelDeliveryResult> {

  const result: SnsPublishResult = await publishSmsToPhone({
    phoneNumber: to,
    message,
  });

  return {
    channel: "sms",
    attempted: result.attempted,
    sent: result.sent,
    provider: "aws-sns",
    messageId: result.messageId,
    reason: result.reason,
    error: result.error,
  };
}

async function sendSmsWithTwilio(message: string, to: string): Promise<ChannelDeliveryResult> {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_PHONE_NUMBER;
  const messagingServiceSid = process.env.TWILIO_MESSAGING_SERVICE_SID;

  if (!accountSid || !authToken) {
    return {
      channel: "sms",
      attempted: false,
      sent: false,
      provider: "twilio",
      reason: "Twilio credentials are not configured",
    };
  }

  if (!from && !messagingServiceSid) {
    return {
      channel: "sms",
      attempted: false,
      sent: false,
      provider: "twilio",
      reason: "Twilio sender is not configured (TWILIO_PHONE_NUMBER or TWILIO_MESSAGING_SERVICE_SID)",
    };
  }

  try {
    const client = twilio(accountSid, authToken);
    const sms = await client.messages.create({
      to,
      body: message,
      ...(messagingServiceSid ? { messagingServiceSid } : { from: from as string }),
    });

    return {
      channel: "sms",
      attempted: true,
      sent: true,
      provider: "twilio",
      messageId: sms.sid,
    };
  } catch (error) {
    return {
      channel: "sms",
      attempted: true,
      sent: false,
      provider: "twilio",
      error: error instanceof Error ? error.message : "Twilio SMS send failed",
    };
  }
}

async function sendEmail(subject: string, message: string, to?: string): Promise<ChannelDeliveryResult> {
  if (!to) {
    return {
      channel: "email",
      attempted: false,
      sent: false,
      provider: "smtp",
      reason: "No email recipient provided",
    };
  }

  const from = process.env.SMTP_FROM;
  const transporter = buildEmailTransporter();
  if (from && transporter) {
    try {
      const info = await transporter.sendMail({
        from,
        to,
        subject,
        text: message,
        html: `<p>${message}</p>`,
      });

      return {
        channel: "email",
        attempted: true,
        sent: true,
        provider: "smtp",
        messageId: info.messageId,
      };
    } catch (error) {
      return {
        channel: "email",
        attempted: true,
        sent: false,
        provider: "smtp",
        error: error instanceof Error ? error.message : "Email send failed",
      };
    }
  }

  const snsFallback = await publishToSns({
    subject,
    message: `${message}\n\nRecipient: ${to}`,
    attributes: {
      event_type: "product.email.fallback",
      recipient_email: to,
    },
  });

  if (snsFallback.sent) {
    return {
      channel: "email",
      attempted: true,
      sent: true,
      provider: "aws-sns-topic",
      messageId: snsFallback.messageId,
      reason: "Delivered via SNS topic subscription fallback",
    };
  }

  return {
    channel: "email",
    attempted: snsFallback.attempted,
    sent: false,
    provider: "aws-sns-topic",
    reason: snsFallback.reason || "SMTP and SNS fallback are not configured",
    error: snsFallback.error,
  }
}

async function makeAwsConnectCall(message: string, to: string): Promise<ChannelDeliveryResult> {
  const region = getConnectRegion();
  const instanceId = process.env.CONNECT_INSTANCE_ID;
  const contactFlowId = process.env.CONNECT_CONTACT_FLOW_ID;
  const sourcePhoneNumber = process.env.CONNECT_SOURCE_PHONE_NUMBER;

  if (!region || !instanceId || !contactFlowId || !sourcePhoneNumber) {
    return {
      channel: "call",
      attempted: false,
      sent: false,
      provider: "aws-connect",
      reason: "AWS Connect call configuration is incomplete",
    };
  }

  try {
    const client = new ConnectClient({ region });
    const command = new StartOutboundVoiceContactCommand({
      DestinationPhoneNumber: to,
      ContactFlowId: contactFlowId,
      InstanceId: instanceId,
      SourcePhoneNumber: sourcePhoneNumber,
      Attributes: {
        notification_message: message,
      },
    });
    const result = await client.send(command);

    return {
      channel: "call",
      attempted: true,
      sent: true,
      provider: "aws-connect",
      messageId: result.ContactId,
    };
  } catch (error) {
    return {
      channel: "call",
      attempted: true,
      sent: false,
      provider: "aws-connect",
      error: error instanceof Error ? error.message : "AWS Connect call failed",
    };
  }
}

async function makeCall(message: string, to?: string): Promise<ChannelDeliveryResult> {
  if (!to) {
    return {
      channel: "call",
      attempted: false,
      sent: false,
      provider: "twilio",
      reason: "No call recipient phone number provided",
    };
  }

  const awsConnectResult = await makeAwsConnectCall(message, to);
  if (awsConnectResult.sent || awsConnectResult.attempted) {
    return awsConnectResult;
  }

  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_PHONE_NUMBER;

  if (!accountSid || !authToken || !from) {
    return {
      channel: "call",
      attempted: false,
      sent: false,
      provider: "twilio",
      reason: "Twilio or AWS Connect call configuration is not set",
    };
  }

  try {
    const client = twilio(accountSid, authToken);
    const call = await client.calls.create({
      to,
      from,
      twiml: buildCallTwiml(message),
    });

    return {
      channel: "call",
      attempted: true,
      sent: true,
      provider: "twilio",
      messageId: call.sid,
    };
  } catch (error) {
    return {
      channel: "call",
      attempted: true,
      sent: false,
      provider: "twilio",
      error: error instanceof Error ? error.message : "Call placement failed",
    };
  }
}

export async function sendProductNotifications(input: ProductNotificationRequest): Promise<ProductNotificationResponse> {
  const channels = new Set(input.channels);
  const response: ProductNotificationResponse = {};
  const subject = input.emailSubject || `Verdant product update: ${input.productName ?? "New update"}`;

  if (channels.has("sms")) {
    response.sms = await sendSms(input.message, input.smsTo);
  }

  if (channels.has("email")) {
    response.email = await sendEmail(subject, input.message, input.emailTo);
  }

  if (channels.has("call")) {
    response.call = await makeCall(input.message, input.callTo);
  }

  return response;
}
