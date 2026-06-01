#!/usr/bin/env bun
/**
 * Generate a fresh VAPID keypair for the Web Push notification channel.
 *
 * Prints three lines ready to paste into `.env.local` (the subject defaults
 * to a placeholder you should replace with your real ops mailbox before
 * shipping to production):
 *
 *   WEB_PUSH_VAPID_PUBLIC=<base64-url public>
 *   WEB_PUSH_VAPID_PRIVATE=<base64-url private>
 *   WEB_PUSH_VAPID_SUBJECT=mailto:notifications@example.com
 *
 * Rotation: same script. Old VAPID keys keep working for already-subscribed
 * browsers until the browser refreshes its subscription — coordinate
 * server + UI VITE_VAPID_PUBLIC_KEY together when you rotate.
 */
import webPush from "web-push";

const { publicKey, privateKey } = webPush.generateVAPIDKeys();

const lines = [
  `WEB_PUSH_VAPID_PUBLIC=${publicKey}`,
  `WEB_PUSH_VAPID_PRIVATE=${privateKey}`,
  `WEB_PUSH_VAPID_SUBJECT=mailto:notifications@example.com`,
];

process.stdout.write(`${lines.join("\n")}\n`);
