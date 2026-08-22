import { ActivityIndicator, Text, View } from "react-native";

export default function LoadingState({ message = "Loading..." }) {
  return (
    <View style={{ alignItems: "center", justifyContent: "center", paddingVertical: 48 }}>
      <ActivityIndicator color="#0066CC" />
      <Text style={{ marginTop: 8, fontSize: 14, color: "#6B7280" }}>{message}</Text>
    </View>
  );
}
