import { Capacitor } from "@capacitor/core";
import { Haptics, ImpactStyle, NotificationType } from "@capacitor/haptics";

// Leichtes Vibrieren in der nativen App (iOS/Android); im Web passiert nichts.
export function hapticTap() {
  if (!Capacitor.isNativePlatform()) return;
  Haptics.impact({ style: ImpactStyle.Light }).catch(() => {});
}

export function hapticSuccess() {
  if (!Capacitor.isNativePlatform()) return;
  Haptics.notification({ type: NotificationType.Success }).catch(() => {});
}
