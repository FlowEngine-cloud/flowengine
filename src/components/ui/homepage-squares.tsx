'use client';

import {
  Mail,
  Database,
  Calendar,
  Globe,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface CompactSquareProps {
  icon: React.ReactNode;
  title: string;
  onClick?: () => void;
}

const CompactSquare = ({ icon, title, onClick }: CompactSquareProps) => {
  return (
    <button
      onClick={onClick}
      className={cn(
        'flex items-center gap-2.5 sm:gap-2 px-3.5 sm:px-3 py-3.5 sm:py-2.5',
        'rounded-lg border border-white/20 sm:border-white/10 bg-white/5',
        'hover:border-white/30 hover:bg-white/10',
        'active:scale-95 transition-all duration-200 cursor-pointer',
        'w-full text-left shadow-sm hover:shadow-md'
      )}
    >
      <div className='text-white/80 sm:text-white/50 flex-shrink-0'>{icon}</div>
      <span className='text-sm sm:text-xs text-white font-semibold sm:font-normal sm:text-white/60 truncate leading-tight'>
        {title}
      </span>
    </button>
  );
};

interface HomepageSquaresProps {
  onPromptSelect: (prompt: string) => void;
}

export function HomepageSquares({ onPromptSelect }: HomepageSquaresProps) {
  const workflowExamples = [
    {
      icon: <Globe className='h-4 w-4' />,
      title: 'Social Media',
      prompt:
        'Build a comprehensive social media automation workflow that automatically posts to Twitter, LinkedIn, Facebook, and Instagram when a new blog post is published on your website. The workflow should include content optimization for each platform (different image sizes, character limits, hashtag strategies), scheduling capabilities, engagement tracking, and analytics reporting. Include error handling for API rate limits and content approval workflows for sensitive posts.',
    },
    {
      icon: <Mail className='h-4 w-4' />,
      title: 'Email Outreach',
      prompt:
        'Create an automated lead generation workflow that searches LinkedIn for relevant prospects based on job title, company, and industry criteria. Extract contact information, enrich lead data with additional details, and automatically send personalized cold emails using templates that include the lead\'s name, company, and specific pain points. Include email tracking, follow-up sequences, and CRM integration to manage the outreach pipeline.',
    },
    {
      icon: <Database className='h-4 w-4' />,
      title: 'Invoice Categorizer',
      prompt:
        'Build an intelligent invoice management workflow that automatically monitors Gmail for incoming invoices and receipts, extracts key information like vendor name, amount, date, and invoice number using OCR or AI, categorizes invoices by vendor or expense type, and saves them to organized folders in Google Drive with proper naming conventions. Include duplicate detection, expense tracking, and monthly summary reports with total expenses by category.',
    },
    {
      icon: <Calendar className='h-4 w-4' />,
      title: 'Follow-Up Automation',
      prompt:
        'Create an automated follow-up system that monitors HubSpot for new leads, tracks their engagement level and time since last contact, and automatically sends personalized follow-up emails at strategic intervals (3 days, 7 days, 14 days). The workflow should include dynamic content based on lead source and interests, stop sending if the lead responds or books a meeting, and update HubSpot contact records with engagement metrics and next steps.',
    },
  ];

  return (
    <div className='space-y-3'>
      <p className='text-sm text-gray-400 sm:hidden px-1 font-medium'>
        Click a prompt to get started:
      </p>
      <div className='grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-2'>
        {workflowExamples.map((example, index) => (
          <CompactSquare
            key={index}
            icon={example.icon}
            title={example.title}
            onClick={() => onPromptSelect(example.prompt)}
          />
        ))}
      </div>
    </div>
  );
}
