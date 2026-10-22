import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Html,
  Img,
  Preview,
  Text,
} from "@react-email/components";
import { Footer } from "./_components/footer";

interface WelcomeProps {
  name: string;
}

export default function Welcome({ name }: WelcomeProps) {
  return (
    <Html>
      <Head />
      <Preview>Your next idea starts here.</Preview>
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
          <Img src="/static/mark.svg" width="36" height="36" alt="Raypx" />
          <Heading style={{ color: "#182033", fontSize: "28px", marginTop: "28px" }}>
            Welcome, {name}.
          </Heading>
          <Text style={{ color: "#586174", fontSize: "16px", lineHeight: "26px" }}>
            Your workspace is ready. Make a little room for your next big idea.
          </Text>
          <Button
            href="https://example.com/workspace"
            style={{
              backgroundColor: "#315ee7",
              borderRadius: "8px",
              color: "#ffffff",
              padding: "14px 22px",
              marginTop: "12px",
            }}
          >
            Open your workspace
          </Button>
          <Footer />
        </Container>
      </Body>
    </Html>
  );
}

Welcome.PreviewProps = { name: "Alex" } satisfies WelcomeProps;
