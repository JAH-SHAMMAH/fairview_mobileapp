import { StyleSheet, Text, TextInput, View } from "react-native";
import { colors } from "../lib/theme";

/** Labelled text box used by the account forms. */
export function Field({ label, value, onChange, keyboard, secure, placeholder, hint }: {
  label: string; value: string; onChange: (v: string) => void;
  keyboard?: "phone-pad" | "email-address"; secure?: boolean; placeholder?: string; hint?: string;
}) {
  return (
    <View style={{ gap: 4 }}>
      <Text style={st.label}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        value={value}
        onChangeText={onChange}
        keyboardType={keyboard}
        secureTextEntry={secure}
        autoCapitalize={keyboard || secure ? "none" : "words"}
        autoCorrect={!keyboard && !secure}
        placeholder={placeholder}
        placeholderTextColor="#9AA5A0"
        style={st.input}
      />
      {hint ? <Text style={st.hint}>{hint}</Text> : null}
    </View>
  );
}

const st = StyleSheet.create({
  label: { fontWeight: "800", color: colors.text },
  input: { borderWidth: 1, borderColor: colors.border, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 11, fontSize: 16, color: colors.text, backgroundColor: "#FBFAF5" },
  hint: { fontSize: 12.5, color: colors.muted },
});
