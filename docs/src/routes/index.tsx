import { createFileRoute } from "@tanstack/react-router";
import { HomePage } from "../components/home";
import { getHomeHead } from "../lib/layout";

export const Route = createFileRoute("/")({
  head: () => getHomeHead("en"),
  component: HomePage,
});
