import axios from 'axios';

const TWILIO_ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID;
const TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN;
const TWILIO_PHONE_NUMBER = process.env.TWILIO_PHONE_NUMBER;

export const sendSMS = async (to: string, message: string): Promise<void> => {
  try {
    // If Twilio credentials are available, use Twilio
    if (TWILIO_ACCOUNT_SID && TWILIO_AUTH_TOKEN && TWILIO_PHONE_NUMBER) {
      await axios.post(
        `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`,
        new URLSearchParams({
          To: to,
          From: TWILIO_PHONE_NUMBER,
          Body: message,
        }),
        {
          auth: {
            username: TWILIO_ACCOUNT_SID,
            password: TWILIO_AUTH_TOKEN,
          },
        }
      );
    } else {
      // Log SMS for development
      console.log('📱 SMS would be sent:');
      console.log(`   To: ${to}`);
      console.log(`   Message: ${message}`);
    }
  } catch (error) {
    // ⚠️ لا نرفع الخطأ — فشل SMS لا يجب أن يمنع إنشاء الحساب أو أي عملية
    console.error('⚠️ SMS service error (non-blocking):', error);
  }
};

export const sendVerificationCode = async (phone: string, code: string): Promise<void> => {
  const message = `رمز التحقق الخاص بك: ${code}\nكاش لاين`;
  await sendSMS(phone, message);
};

export const sendOrderNotification = async (
  phone: string,
  orderNumber: string,
  status: string
): Promise<void> => {
  const messages: Record<string, string> = {
    PENDING: `تم استلام طلبك #${orderNumber} وسيتم معالجته قريباً.`,
    ACCEPTED: `تم قبول طلبك #${orderNumber} وجاري التحضير.`,
    READY: `طلبك #${orderNumber} جاهز للاستلام.`,
    IN_TRANSIT: `طلبك #${orderNumber} في الطريق إليك.`,
    DELIVERED: `تم تسليم طلبك #${orderNumber} بنجاح. شكراً لاستخدامك كاش لاين!`,
  };

  const message = messages[status] || `تحديث حالة الطلب #${orderNumber}: ${status}`;
  await sendSMS(phone, message);
};
