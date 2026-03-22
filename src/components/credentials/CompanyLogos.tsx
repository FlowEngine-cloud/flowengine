'use client';

/**
 * CompanyLogos - Real company SVG logos for credentials (monochrome)
 * ONLY includes 100% verified, accurate logos from major services
 * All logos use currentColor for consistent styling
 */

import { cn } from '@/lib/utils';

interface LogoProps {
  className?: string;
}

// Google "G" Logo
export function GoogleLogo({ className }: LogoProps) {
  return (
    <svg viewBox="0 0 24 24" className={cn('h-4 w-4', className)} fill="currentColor">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
    </svg>
  );
}

// GitHub Logo
export function GitHubLogo({ className }: LogoProps) {
  return (
    <svg viewBox="0 0 24 24" className={cn('h-4 w-4', className)} fill="currentColor">
      <path d="M12 2C6.477 2 2 6.477 2 12c0 4.42 2.865 8.17 6.839 9.49.5.092.682-.217.682-.482 0-.237-.008-.866-.013-1.7-2.782.603-3.369-1.34-3.369-1.34-.454-1.156-1.11-1.463-1.11-1.463-.908-.62.069-.608.069-.608 1.003.07 1.531 1.03 1.531 1.03.892 1.529 2.341 1.087 2.91.831.092-.646.35-1.086.636-1.336-2.22-.253-4.555-1.11-4.555-4.943 0-1.091.39-1.984 1.029-2.683-.103-.253-.446-1.27.098-2.647 0 0 .84-.269 2.75 1.025A9.578 9.578 0 0112 6.836c.85.004 1.705.114 2.504.336 1.909-1.294 2.747-1.025 2.747-1.025.546 1.377.203 2.394.1 2.647.64.699 1.028 1.592 1.028 2.683 0 3.842-2.339 4.687-4.566 4.935.359.309.678.919.678 1.852 0 1.336-.012 2.415-.012 2.743 0 .267.18.578.688.48C19.138 20.167 22 16.418 22 12c0-5.523-4.477-10-10-10z"/>
    </svg>
  );
}

// Slack Logo
export function SlackLogo({ className }: LogoProps) {
  return (
    <svg viewBox="0 0 24 24" className={cn('h-4 w-4', className)} fill="currentColor">
      <path d="M5.042 15.165a2.528 2.528 0 0 1-2.52 2.523A2.528 2.528 0 0 1 0 15.165a2.527 2.527 0 0 1 2.522-2.52h2.52v2.52zM6.313 15.165a2.527 2.527 0 0 1 2.521-2.52 2.527 2.527 0 0 1 2.521 2.52v6.313A2.528 2.528 0 0 1 8.834 24a2.528 2.528 0 0 1-2.521-2.522v-6.313zM8.834 5.042a2.528 2.528 0 0 1-2.521-2.52A2.528 2.528 0 0 1 8.834 0a2.528 2.528 0 0 1 2.521 2.522v2.52H8.834zM8.834 6.313a2.528 2.528 0 0 1 2.521 2.521 2.528 2.528 0 0 1-2.521 2.521H2.522A2.528 2.528 0 0 1 0 8.834a2.528 2.528 0 0 1 2.522-2.521h6.312zM18.956 8.834a2.528 2.528 0 0 1 2.522-2.521A2.528 2.528 0 0 1 24 8.834a2.528 2.528 0 0 1-2.522 2.521h-2.522V8.834zM17.688 8.834a2.528 2.528 0 0 1-2.523 2.521 2.527 2.527 0 0 1-2.52-2.521V2.522A2.527 2.527 0 0 1 15.165 0a2.528 2.528 0 0 1 2.523 2.522v6.312zM15.165 18.956a2.528 2.528 0 0 1 2.523 2.522A2.528 2.528 0 0 1 15.165 24a2.527 2.527 0 0 1-2.52-2.522v-2.522h2.52zM15.165 17.688a2.527 2.527 0 0 1-2.52-2.523 2.526 2.526 0 0 1 2.52-2.52h6.313A2.527 2.527 0 0 1 24 15.165a2.528 2.528 0 0 1-2.522 2.523h-6.313z"/>
    </svg>
  );
}

// LinkedIn Logo
export function LinkedInLogo({ className }: LogoProps) {
  return (
    <svg viewBox="0 0 24 24" className={cn('h-4 w-4', className)} fill="currentColor">
      <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
    </svg>
  );
}

// Stripe Logo
export function StripeLogo({ className }: LogoProps) {
  return (
    <svg viewBox="0 0 24 24" className={cn('h-4 w-4', className)} fill="currentColor">
      <path d="M13.976 9.15c-2.172-.806-3.356-1.426-3.356-2.409 0-.831.683-1.305 1.901-1.305 2.227 0 4.515.858 6.09 1.631l.89-5.494C18.252.975 15.697 0 12.165 0 9.667 0 7.589.654 6.104 1.872 4.56 3.147 3.757 4.992 3.757 7.218c0 4.039 2.467 5.76 6.476 7.219 2.585.92 3.445 1.574 3.445 2.583 0 .98-.84 1.545-2.354 1.545-1.875 0-4.965-.921-6.99-2.109l-.9 5.555C5.175 22.99 8.385 24 11.714 24c2.641 0 4.843-.624 6.328-1.813 1.664-1.305 2.525-3.236 2.525-5.732 0-4.128-2.524-5.851-6.591-7.305z"/>
    </svg>
  );
}

// Twitter/X Logo
export function TwitterLogo({ className }: LogoProps) {
  return (
    <svg viewBox="0 0 24 24" className={cn('h-4 w-4', className)} fill="currentColor">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
    </svg>
  );
}


// Microsoft Logo
export function MicrosoftLogo({ className }: LogoProps) {
  return (
    <svg viewBox="0 0 24 24" className={cn('h-4 w-4', className)} fill="currentColor">
      <path d="M11.4 24H0V12.6h11.4V24zM24 24H12.6V12.6H24V24zM11.4 11.4H0V0h11.4v11.4zm12.6 0H12.6V0H24v11.4z"/>
    </svg>
  );
}

// Discord Logo
export function DiscordLogo({ className }: LogoProps) {
  return (
    <svg viewBox="0 0 24 24" className={cn('h-4 w-4', className)} fill="currentColor">
      <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/>
    </svg>
  );
}

// Notion Logo
export function NotionLogo({ className }: LogoProps) {
  return (
    <svg viewBox="0 0 24 24" className={cn('h-4 w-4', className)} fill="currentColor">
      <path d="M4.459 4.208c.746.606 1.026.56 2.428.466l13.215-.793c.28 0 .047-.28-.046-.326L17.86 1.968c-.42-.326-.981-.7-2.055-.607L3.01 2.295c-.466.046-.56.28-.374.466zm.793 3.08v13.904c0 .747.373 1.027 1.214.98l14.523-.84c.841-.046.935-.56.935-1.167V6.354c0-.606-.233-.933-.748-.887l-15.177.887c-.56.047-.747.327-.747.933zm14.337.745c.093.42 0 .84-.42.888l-.7.14v10.264c-.608.327-1.168.514-1.635.514-.748 0-.935-.234-1.495-.933l-4.577-7.186v6.952L12.21 19s0 .84-1.168.84l-3.222.186c-.093-.186 0-.653.327-.746l.84-.233V9.854L7.822 9.76c-.094-.42.14-1.026.793-1.073l3.456-.233 4.764 7.279v-6.44l-1.215-.139c-.093-.514.28-.887.747-.933zM1.936 1.035l13.31-.98c1.634-.14 2.055-.047 3.082.7l4.249 2.986c.7.513.934.653.934 1.213v16.378c0 1.026-.373 1.634-1.68 1.726l-15.458.934c-.98.047-1.448-.093-1.962-.747l-3.129-4.06c-.56-.747-.793-1.306-.793-1.96V2.667c0-.839.374-1.54 1.447-1.632z"/>
    </svg>
  );
}

// Airtable Logo
export function AirtableLogo({ className }: LogoProps) {
  return (
    <svg viewBox="0 0 24 24" className={cn('h-4 w-4', className)} fill="currentColor">
      <path d="M10.226 2.123a2.317 2.317 0 0 1 3.548 0l8.48 10.238a2.317 2.317 0 0 1-1.774 3.807h-1.446l.001 3.515a2.317 2.317 0 0 1-2.317 2.317H7.282a2.317 2.317 0 0 1-2.317-2.317v-3.515H3.52a2.317 2.317 0 0 1-1.774-3.807l8.48-10.238zm1.183.994a.772.772 0 0 0-1.183 0L1.746 13.355a.772.772 0 0 0 .591 1.269h4.41a.772.772 0 0 1 .772.772v4.287a.772.772 0 0 0 .772.772h8.436a.772.772 0 0 0 .772-.772v-4.287a.772.772 0 0 1 .772-.772h4.41a.772.772 0 0 0 .591-1.269L11.409 3.117z"/>
    </svg>
  );
}

// OpenAI Logo
export function OpenAILogo({ className }: LogoProps) {
  return (
    <svg viewBox="0 0 24 24" className={cn('h-4 w-4', className)} fill="currentColor">
      <path d="M22.282 9.821a5.985 5.985 0 0 0-.516-4.91 6.046 6.046 0 0 0-6.51-2.9A6.065 6.065 0 0 0 4.981 4.18a5.985 5.985 0 0 0-3.998 2.9 6.046 6.046 0 0 0 .743 7.097 5.98 5.98 0 0 0 .51 4.911 6.051 6.051 0 0 0 6.515 2.9A5.985 5.985 0 0 0 13.26 24a6.056 6.056 0 0 0 5.772-4.206 5.99 5.99 0 0 0 3.997-2.9 6.056 6.056 0 0 0-.747-7.073zM13.26 22.43a4.476 4.476 0 0 1-2.876-1.04l.141-.081 4.779-2.758a.795.795 0 0 0 .392-.681v-6.737l2.02 1.168a.071.071 0 0 1 .038.052v5.583a4.504 4.504 0 0 1-4.494 4.494zM3.6 18.304a4.47 4.47 0 0 1-.535-3.014l.142.085 4.783 2.759a.771.771 0 0 0 .78 0l5.843-3.369v2.332a.08.08 0 0 1-.033.062L9.74 19.95a4.5 4.5 0 0 1-6.14-1.646zM2.34 7.896a4.485 4.485 0 0 1 2.366-1.973V11.6a.766.766 0 0 0 .388.676l5.815 3.355-2.02 1.168a.076.076 0 0 1-.071 0l-4.83-2.786A4.504 4.504 0 0 1 2.34 7.872zm16.597 3.855l-5.833-3.387L15.119 7.2a.076.076 0 0 1 .071 0l4.83 2.791a4.494 4.494 0 0 1-.676 8.105v-5.678a.79.79 0 0 0-.407-.667zm2.01-3.023l-.141-.085-4.774-2.782a.776.776 0 0 0-.785 0L9.409 9.23V6.897a.066.066 0 0 1 .028-.061l4.83-2.787a4.5 4.5 0 0 1 6.68 4.66zm-12.64 4.135l-2.02-1.164a.08.08 0 0 1-.038-.057V6.075a4.5 4.5 0 0 1 7.375-3.453l-.142.08L8.704 5.46a.795.795 0 0 0-.393.681zm1.097-2.365l2.602-1.5 2.607 1.5v2.999l-2.597 1.5-2.607-1.5z"/>
    </svg>
  );
}

// Reddit Logo
export function RedditLogo({ className }: LogoProps) {
  return (
    <svg viewBox="0 0 24 24" className={cn('h-4 w-4', className)} fill="currentColor">
      <path d="M12 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0zm5.01 4.744c.688 0 1.25.561 1.25 1.249a1.25 1.25 0 0 1-2.498.056l-2.597-.547-.8 3.747c1.824.07 3.48.632 4.674 1.488.308-.309.73-.491 1.207-.491.968 0 1.754.786 1.754 1.754 0 .716-.435 1.333-1.01 1.614a3.111 3.111 0 0 1 .042.52c0 2.694-3.13 4.87-7.004 4.87-3.874 0-7.004-2.176-7.004-4.87 0-.183.015-.366.043-.534A1.748 1.748 0 0 1 4.028 12c0-.968.786-1.754 1.754-1.754.463 0 .898.196 1.207.49 1.207-.883 2.878-1.43 4.744-1.487l.885-4.182a.342.342 0 0 1 .14-.197.35.35 0 0 1 .238-.042l2.906.617a1.214 1.214 0 0 1 1.108-.701zM9.25 12C8.561 12 8 12.562 8 13.25c0 .687.561 1.248 1.25 1.248.687 0 1.248-.561 1.248-1.249 0-.688-.561-1.249-1.249-1.249zm5.5 0c-.687 0-1.248.561-1.248 1.25 0 .687.561 1.248 1.249 1.248.688 0 1.249-.561 1.249-1.249 0-.687-.562-1.249-1.25-1.249zm-5.466 3.99a.327.327 0 0 0-.231.094.33.33 0 0 0 0 .463c.842.842 2.484.913 2.961.913.477 0 2.105-.056 2.961-.913a.361.361 0 0 0 .029-.463.33.33 0 0 0-.464 0c-.547.533-1.684.73-2.512.73-.828 0-1.979-.196-2.512-.73a.326.326 0 0 0-.232-.095z"/>
    </svg>
  );
}

// SerpAPI Logo
export function SerpAPILogo({ className }: LogoProps) {
  return (
    <svg viewBox="0 0 24 24" className={cn('h-4 w-4', className)} fill="currentColor">
      <path d="M15.5 14h-.79l-.28-.27A6.471 6.471 0 0 0 16 9.5 6.5 6.5 0 1 0 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/>
      <circle cx="9.5" cy="9.5" r="1.5"/>
      <path d="M12 9.5c0-.83-.67-1.5-1.5-1.5h-2v3h2c.83 0 1.5-.67 1.5-1.5z"/>
    </svg>
  );
}

/**
 * Map credential types to their logo components
 * Only includes verified, accurate logos from major services
 */
export const CREDENTIAL_LOGOS: Record<string, React.ComponentType<LogoProps>> = {
  // Google - all services use the unified Google logo
  'google': GoogleLogo,
  'googleoauth2': GoogleLogo,
  'googleoauth2api': GoogleLogo,
  'googledriveoauth2api': GoogleLogo,
  'googledrive': GoogleLogo,
  'drive': GoogleLogo,
  'googlesheetsoauth2api': GoogleLogo,
  'googlesheets': GoogleLogo,
  'sheets': GoogleLogo,
  'googledocsoauth2api': GoogleLogo,
  'googledocs': GoogleLogo,
  'docs': GoogleLogo,
  'googlecalendaroauth2api': GoogleLogo,
  'googlecalendar': GoogleLogo,
  'gmailoauth2': GoogleLogo,
  'gmail': GoogleLogo,
  'googlebigqueryoauth2api': GoogleLogo,
  'googlebigquery': GoogleLogo,
  'bigquery': GoogleLogo,
  'googleanalyticsoauth2api': GoogleLogo,
  'googleanalytics': GoogleLogo,
  'analytics': GoogleLogo,
  'googletasksoauth2api': GoogleLogo,
  'googletasks': GoogleLogo,
  'tasks': GoogleLogo,
  'googleslidesoauth2api': GoogleLogo,
  'googleslides': GoogleLogo,
  'slides': GoogleLogo,
  'googletranslateoauth2api': GoogleLogo,
  'googletranslate': GoogleLogo,
  'translate': GoogleLogo,
  'googlevertexoauth2api': GoogleLogo,
  'googlevertex': GoogleLogo,
  'vertex': GoogleLogo,
  'gemini': GoogleLogo,
  'googleformsauth2api': GoogleLogo,
  'googleformsoauth2api': GoogleLogo,
  'googleforms': GoogleLogo,
  'forms': GoogleLogo,
  'googleadsoauth2api': GoogleLogo,
  'googleads': GoogleLogo,
  'ads': GoogleLogo,
  'googlecontactsoauth2api': GoogleLogo,
  'googlecontacts': GoogleLogo,
  'contacts': GoogleLogo,
  'googlechatoauth2api': GoogleLogo,
  'googlechat': GoogleLogo,
  'chat': GoogleLogo,
  'googlebooksoauth2api': GoogleLogo,
  'googlebooks': GoogleLogo,
  'googlecloudstorageauth2api': GoogleLogo,
  'googlecloudstorage': GoogleLogo,
  'googlebusinessprofileoauth2api': GoogleLogo,
  'googlebusinessprofile': GoogleLogo,
  'googlefirebasecloudfirestore': GoogleLogo,
  'googlefirebaserealtimeatabase': GoogleLogo,
  'googleanalyticsoauth2': GoogleLogo,

  // GitHub
  'github': GitHubLogo,
  'githuboauth2api': GitHubLogo,
  'githuboauth2': GitHubLogo,

  // Slack
  'slack': SlackLogo,
  'slackoauth2api': SlackLogo,
  'slackoauth2': SlackLogo,

  // LinkedIn
  'linkedin': LinkedInLogo,
  'linkedinoauth2api': LinkedInLogo,
  'linkedinoauth2': LinkedInLogo,

  // Stripe
  'stripe': StripeLogo,
  'stripeapi': StripeLogo,

  // Twitter/X
  'twitter': TwitterLogo,
  'twitteroauth2api': TwitterLogo,
  'twitteroauth2': TwitterLogo,

  // Microsoft
  'microsoft': MicrosoftLogo,
  'microsoftoauth2api': MicrosoftLogo,
  'microsoftoauth2': MicrosoftLogo,

  // Discord
  'discord': DiscordLogo,
  'discordoauth2api': DiscordLogo,
  'discordoauth2': DiscordLogo,

  // Notion
  'notion': NotionLogo,
  'notionoauth2api': NotionLogo,
  'notionoauth2': NotionLogo,

  // Airtable
  'airtable': AirtableLogo,
  'airtableoauth2api': AirtableLogo,
  'airtableoauth2': AirtableLogo,

  // OpenAI
  'openai': OpenAILogo,
  'openaiapi': OpenAILogo,

  // Reddit
  'reddit': RedditLogo,
  'redditoauth2api': RedditLogo,
  'redditoauth2': RedditLogo,

  // SerpAPI
  'serpapi': SerpAPILogo,
  'serpapiapi': SerpAPILogo,
};

/**
 * Get the logo component for a credential type
 * Returns null if no logo is available (should fallback to Lucide icon)
 */
export function getCredentialLogo(iconType: string): React.ComponentType<LogoProps> | null {
  // Normalize the type
  const normalizedType = iconType
    .replace(/OAuth2Api$/i, '')
    .replace(/OAuth2$/i, '')
    .replace(/Api$/i, '')
    .replace(/Credentials?$/i, '')
    .replace(/^n8n[-_]?nodes[-_]?/i, '')
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');

  // Try direct match with normalized type
  if (CREDENTIAL_LOGOS[normalizedType]) {
    return CREDENTIAL_LOGOS[normalizedType];
  }

  // Try original lowercase
  const lowerOriginal = iconType.toLowerCase().replace(/[^a-z0-9]/g, '');
  if (CREDENTIAL_LOGOS[lowerOriginal]) {
    return CREDENTIAL_LOGOS[lowerOriginal];
  }

  // No logo found - return null to fall back to Lucide icons
  return null;
}
