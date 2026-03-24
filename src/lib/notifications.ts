export interface EmailNotification {
  to: string;
  subject: string;
  body: string;
}

export const sendNotification = async (notification: EmailNotification) => {
  try {
    const response = await fetch('/api/notify', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(notification),
    });

    if (!response.ok) {
      throw new Error('Failed to send notification');
    }

    return await response.json();
  } catch (error) {
    console.error('Notification error:', error);
    // Silent failure for notifications to not block the main process
    return { success: false, error };
  }
};

export interface SMSNotification {
  to: string;
  body: string;
}

export const sendSMSNotification = async (notification: SMSNotification) => {
  try {
    const response = await fetch('/api/notify/sms', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(notification),
    });

    if (!response.ok) {
      throw new Error('Failed to send SMS notification');
    }

    return await response.json();
  } catch (error) {
    console.error('SMS Notification error:', error);
    return { success: false, error };
  }
};

export const sendApprovalEmailWithPDF = async (to: string, requestData: any, approverName: string) => {
  try {
    const response = await fetch('/api/notify/approval-pdf', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ to, requestData, approverName }),
    });

    if (!response.ok) {
      throw new Error('Failed to send approval email with PDF');
    }

    return await response.json();
  } catch (error) {
    console.error('Approval PDF Email error:', error);
    return { success: false, error };
  }
};
