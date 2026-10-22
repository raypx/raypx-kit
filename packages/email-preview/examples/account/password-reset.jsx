import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Html,
  Preview,
  Text,
} from "@react-email/components";
import { Footer } from "../_components/footer";

export default function PasswordReset({ resetUrl }) {
  return (
    <Html>
      <Head />
      <Preview>A fresh start for your password.</Preview>
      <Body
        style={{
          backgroundColor: "#f4f5f7",
          fontFamily: "Arial, sans-serif",
          padding: "36px 16px",
        }}
      >
        <Container
          style={{
            backgroundColor: "#ffffff",
            borderRadius: "12px",
            padding: "36px",
            maxWidth: "560px",
          }}
        >
          <Heading style={{ color: "#182033", fontSize: "26px" }}>Reset your password</Heading>
          <Text style={{ color: "#586174", fontSize: "16px", lineHeight: "26px" }}>
            We received a request to reset your password. This link is valid for 30 minutes.
          </Text>
          <Button
            href={resetUrl}
            style={{
              backgroundColor: "#315ee7",
              borderRadius: "8px",
              color: "#ffffff",
              padding: "14px 22px",
            }}
          >
            Choose a new password
          </Button>
          <Text style={{ color: "#586174", fontSize: "14px", lineHeight: "22px" }}>
            If you did not request this, you can safely ignore this email.
          </Text>
          <Footer />
        </Container>
      </Body>
    </Html>
  );
}

PasswordReset.PreviewProps = { resetUrl: "https://example.com/reset?token=preview" };
