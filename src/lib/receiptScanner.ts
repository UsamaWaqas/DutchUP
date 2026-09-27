import * as ImagePicker from 'expo-image-picker';
import TextRecognition from '@react-native-ml-kit/text-recognition';
import { parseReceiptTotal } from './receiptParser';

export interface ScannedReceipt {
  /** Best-guess total, or `null` if no number was readable on the receipt. */
  amount: number | null;
  rawText: string;
}

/** `null` means the user cancelled or denied permission — not an error to surface. */
export async function scanReceipt(source: 'camera' | 'library'): Promise<ScannedReceipt | null> {
  const permission = source === 'camera' ? await ImagePicker.requestCameraPermissionsAsync() : await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (permission.status !== 'granted') return null;

  const result =
    source === 'camera'
      ? await ImagePicker.launchCameraAsync({ quality: 0.7, allowsEditing: true })
      : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.7, allowsEditing: true });
  if (result.canceled || !result.assets?.[0]) return null;

  const { text } = await TextRecognition.recognize(result.assets[0].uri);
  return { amount: parseReceiptTotal(text), rawText: text };
}
