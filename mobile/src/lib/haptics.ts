import * as Haptics from "expo-haptics";
import { Platform } from "react-native";

const isNative = Platform.OS === "ios" || Platform.OS === "android";

export async function hapticImpact(style: Haptics.ImpactFeedbackStyle = Haptics.ImpactFeedbackStyle.Light) {
  if (!isNative) return;
  await Haptics.impactAsync(style);
}

export async function hapticSelection() {
  if (!isNative) return;
  await Haptics.selectionAsync();
}

export async function hapticNotification(type: Haptics.NotificationFeedbackType) {
  if (!isNative) return;
  await Haptics.notificationAsync(type);
}

export { Haptics };
