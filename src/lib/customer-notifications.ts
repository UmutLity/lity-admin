import prisma from "@/lib/prisma";

export async function createCustomerNotification(userId: string, type: string, message: string) {
  return prisma.notification.create({
    data: {
      userId,
      type,
      message,
    },
  });
}
