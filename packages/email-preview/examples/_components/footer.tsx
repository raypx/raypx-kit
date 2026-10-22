import { Hr, Text } from "@react-email/components";

export function Footer() {
  return (
    <>
      <Hr style={{ borderColor: "#e7e9ef", marginTop: "32px" }} />
      <Text style={{ color: "#8590a3", fontSize: "12px", lineHeight: "18px" }}>
        Raypx · A little space for your next idea.
      </Text>
    </>
  );
}
