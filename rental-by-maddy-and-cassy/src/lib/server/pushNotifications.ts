import { getAdminDb, getAdminMessaging } from "@/src/lib/firebase/admin";

export async function sendPushNotification(input: {
  userId: string;
  title: string;
  body: string;
  actionUrl: string;
}): Promise<void> {
  const tokensSnapshot = await getAdminDb()
    .collection("users")
    .doc(input.userId)
    .collection("pushTokens")
    .get();
  const tokens = tokensSnapshot.docs
    .map((item) => item.data().token)
    .filter((token): token is string => typeof token === "string" && token.length > 20);
  if (!tokens.length) return;

  const response = await getAdminMessaging().sendEachForMulticast({
    tokens,
    notification: {
      title: input.title,
      body: input.body,
    },
    data: {
      actionUrl: input.actionUrl,
    },
    webpush: {
      fcmOptions: {
        link: input.actionUrl,
      },
      notification: {
        icon: "/images/maddy-cassy-rentals-icon.png",
      },
    },
  });

  const invalidIndexes = response.responses
    .map((item, index) => ({ item, index }))
    .filter(({ item }) =>
      !item.success &&
      [
        "messaging/invalid-registration-token",
        "messaging/registration-token-not-registered",
      ].includes(item.error?.code ?? ""),
    )
    .map(({ index }) => index);

  if (invalidIndexes.length) {
    const batch = getAdminDb().batch();
    invalidIndexes.forEach((index) => {
      const snapshot = tokensSnapshot.docs.find((item) => item.data().token === tokens[index]);
      if (snapshot) batch.delete(snapshot.ref);
    });
    await batch.commit();
  }
}
