import { Text, TouchableOpacity, View } from "react-native";

export default function ErrorState({ message = "Something went wrong.", onRetry }) {
  return (
    <View style={{ alignItems: "center", justifyContent: "center", gap: 12, paddingVertical: 48 }}>
      <Text style={{ fontSize: 14, color: "#6B7280", textAlign: "center" }}>{message}</Text>
      {onRetry ? (
        <TouchableOpacity
          onPress={onRetry}
          style={{ backgroundColor: "#0066CC", paddingHorizontal: 16, paddingVertical: 10, borderRadius: 12 }}
        >
          <Text style={{ color: "#FFFFFF", fontSize: 14, fontWeight: "600" }}>Retry</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}
