import { MessageAttributeValue, PublishCommand, SNSClient } from "@aws-sdk/client-sns";

export interface SnsPublishResult {
  attempted: boolean;
  sent: boolean;
  messageId?: string;
  reason?: string;
  error?: string;
}

interface PublishInput {
  subject: string;
  message: string;
  topicArn?: string;
  attributes?: Record<string, string>;
}

interface DirectSmsInput {
  phoneNumber: string;
  message: string;
  smsType?: "Transactional" | "Promotional";
}

interface PurchaseNotificationInput {
  transactionId: number;
  customerId: number;
  total: number;
  itemCount: number;
  purchasedAt: string;
}

let snsClient: SNSClient | null = null;

function getRegion(): string | undefined {
  return process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION;
}

function getTopicArn(): string | undefined {
  return process.env.AWS_SNS_TOPIC_ARN;
}

function getSnsClient(): SNSClient | null {
  const region = getRegion();
  if (!region) return null;

  if (!snsClient) {
    snsClient = new SNSClient({ region });
  }

  return snsClient;
}

function buildAttributes(attributes: Record<string, string> | undefined): Record<string, MessageAttributeValue> | undefined {
  if (!attributes) return undefined;

  const mapped: Record<string, MessageAttributeValue> = {};
  for (const [key, value] of Object.entries(attributes)) {
    mapped[key] = {
      DataType: "String",
      StringValue: value,
    };
  }

  return mapped;
}

export async function publishToSns(input: PublishInput): Promise<SnsPublishResult> {
  const topicArn = input.topicArn || getTopicArn();
  if (!topicArn) {
    return {
      attempted: false,
      sent: false,
      reason: "AWS_SNS_TOPIC_ARN is not configured",
    };
  }

  const client = getSnsClient();
  if (!client) {
    return {
      attempted: false,
      sent: false,
      reason: "AWS_REGION or AWS_DEFAULT_REGION is not configured",
    };
  }

  try {
    const response = await client.send(
      new PublishCommand({
        TopicArn: topicArn,
        Subject: input.subject,
        Message: input.message,
        MessageAttributes: buildAttributes(input.attributes),
      }),
    );

    return {
      attempted: true,
      sent: true,
      messageId: response.MessageId,
    };
  } catch (error) {
    return {
      attempted: true,
      sent: false,
      error: error instanceof Error ? error.message : "SNS publish failed",
    };
  }
}

export async function publishPurchaseNotification(input: PurchaseNotificationInput): Promise<SnsPublishResult> {
  const subject = `Verdant purchase #${input.transactionId}`;
  const message = JSON.stringify(
    {
      event: "purchase.completed",
      transaction_id: input.transactionId,
      customer_id: input.customerId,
      total: input.total,
      item_count: input.itemCount,
      purchased_at: input.purchasedAt,
    },
    null,
    2,
  );

  return publishToSns({
    subject,
    message,
    attributes: {
      event_type: "purchase.completed",
      customer_id: String(input.customerId),
      transaction_id: String(input.transactionId),
    },
  });
}

export async function publishSmsToPhone(input: DirectSmsInput): Promise<SnsPublishResult> {
  const client = getSnsClient();
  if (!client) {
    return {
      attempted: false,
      sent: false,
      reason: "AWS_REGION or AWS_DEFAULT_REGION is not configured",
    };
  }

  try {
    const response = await client.send(
      new PublishCommand({
        PhoneNumber: input.phoneNumber,
        Message: input.message,
        MessageAttributes: {
          "AWS.SNS.SMS.SMSType": {
            DataType: "String",
            StringValue: input.smsType ?? "Transactional",
          },
        },
      }),
    );

    return {
      attempted: true,
      sent: true,
      messageId: response.MessageId,
    };
  } catch (error) {
    return {
      attempted: true,
      sent: false,
      error: error instanceof Error ? error.message : "SNS SMS publish failed",
    };
  }
}
