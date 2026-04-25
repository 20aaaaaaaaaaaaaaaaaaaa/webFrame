import { createFileRoute, Link } from '@tanstack/react-router';
import { ArrowRight, Star } from 'lucide-react';
import { WebFrameLogo } from '@/components/brand/webframe-logo';
import { Button } from '@/components/ui/button';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { useTranslation } from 'react-i18next';
import { Globe } from 'lucide-react';
import { useSettingsStore } from '@/features/settings/stores/settings-store';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

export const Route = createFileRoute('/')({
  component: LandingPage,
});

function LandingPage() {
  const { t } = useTranslation();
  const appLanguage = useSettingsStore((s) => s.appLanguage);
  const setSetting = useSettingsStore((s) => s.setSetting);

  const faqItems = [
    {
      question: t('faq.q1', 'Is webFrame really free?'),
      answer: t('faq.a1', 'Yes, webFrame is completely free and open source under the MIT license. There are no hidden fees, subscriptions, or watermarks.'),
    },
    {
      question: t('faq.q2', 'Do I need to install anything?'),
      answer: t('faq.a2', 'No installation required. webFrame runs entirely in your browser. Just open the website and start editing.'),
    },
    {
      question: t('faq.q3', 'Where are my videos stored?'),
      answer: t('faq.a3', 'Your videos and projects are stored locally in your browser or referenced to your local files using modern storage APIs.'),
    },
    {
      id: 'browser-support',
      question: t('faq.q4', 'What browsers are supported?'),
      answer: (
        <>
          <p className="mb-3">
            {t('faq.a4_1')}
          </p>
          <p>
            <strong>{t('faq.a4_2')}</strong>{' '}
            <code className="rounded bg-muted px-1 py-0.5 text-xs">
              brave://flags/#file-system-access-api
            </code>
            {', '}
            {t('faq.a4_3', 'set it to')}{' '}
            <strong>{t('faq.a4_4', 'Enabled')}</strong>
            {t('faq.a4_5', ', and relaunch the browser.')}
          </p>
        </>
      ),
    },
    {
      question: t('faq.q5', 'What export formats are supported?'),
      answer: t('faq.a5'),
    },
    {
      question: t('faq.q6', 'Future Improvements'),
      answer: t('faq.a6'),
    },
    {
      question: t('faq.q7', 'Special shoutout'),
      answer: (
        <>
          <p className="mb-3">
            {t('faq.a7_1')}{' '}
            <a href="https://mediabunny.dev/" target="_blank" rel="noopener noreferrer" className="text-primary underline hover:text-primary/80">
              Mediabunny
            </a>{' '}
            {t('faq.a7_2')}
          </p>
          <p className="mb-2 font-medium text-foreground">{t('faq.a7_3')}</p>
          <ul className="list-disc pl-5 space-y-1">
            <li>React</li>
            <li>TypeScript</li>
            <li>Vite</li>
            <li>Shadcn</li>
          </ul>
        </>
      ),
    },
    {
      question: t('faq.q8', 'Where is this project based on?'),
      answer: (
        <p>
          {t('faq.a8_1', 'webFrame is based on the open-source project')}{' '}
          <a href="https://github.com/walterlow/freecut" target="_blank" rel="noopener noreferrer" className="text-primary underline hover:text-primary/80">
            Freecut
          </a>
          {' '}
          {t('faq.a8_2', 'created by walterlow.')}
        </p>
      ),
    },
  ];



  return (
    <div className="min-h-screen bg-background text-foreground select-text">
      {/* Top Header with Language Switcher */}
      <header className="fixed top-0 right-0 z-50 p-6">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground mr-2">
            <Globe className="h-4 w-4" />
            <span>{t('landing.selectLanguage', 'Select Language')}</span>
          </div>
          <Select
            value={appLanguage}
            onValueChange={(value) => setSetting('appLanguage', value as 'tr' | 'en')}
          >
            <SelectTrigger className="h-9 w-[120px] bg-background/50 backdrop-blur-sm border-white/10 hover:bg-background/80 transition-colors">
              <SelectValue />
            </SelectTrigger>
            <SelectContent align="end">
              <SelectItem value="tr">Türkçe</SelectItem>
              <SelectItem value="en">English</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative flex h-screen flex-col items-center justify-center px-6">
        {/* Subtle gradient background */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute left-1/2 top-1/2 h-[600px] w-[600px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/5 blur-3xl" />
        </div>

        <div className="relative z-10 flex flex-col items-center text-center animate-fade-in">
          <div className="mb-6 flex items-center gap-3">
            <WebFrameLogo size="lg" />
            <span className="rounded-full bg-primary/15 px-3 py-1 text-xs font-medium text-primary">
              {t('landing.beta', 'Beta')}
            </span>
          </div>

          <h1 className="mb-3 max-w-xl text-2xl font-bold tracking-tight sm:text-3xl md:text-4xl">
            {t('landing.title')} <br className="sm:hidden" />
            <span className="text-primary">{t('landing.subtitle')}</span>
          </h1>

          <p className="mb-4 max-w-md text-sm text-muted-foreground sm:text-base">
            {t('landing.description')}
          </p>

          <p className="mb-4 max-w-md text-xs text-amber-600 dark:text-amber-500">
            {t('landing.disclaimer')}
          </p>

          <div className="flex flex-col items-center gap-4 sm:flex-row">
            <Button asChild size="lg" className="gap-2 px-8">
              <Link to="/projects">
                {t('landing.getStarted')}
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>

            <Button asChild variant="outline" size="lg" className="gap-2">
              <a
                href="https://github.com/20aaaaaaaaaaaaaaaaaaaa/webFrame"
                target="_blank"
                rel="noopener noreferrer"
              >
                <Star className="h-4 w-4" />
                {t('landing.starGithub')}
              </a>
            </Button>
          </div>
        </div>
      </section>



      {/* FAQ Section */}
      <section className="border-t border-border bg-card/50 px-6 py-20">
        <div className="mx-auto max-w-3xl">
          <div className="mb-10 text-center">
            <h2 className="mb-4 text-3xl font-bold tracking-tight sm:text-4xl">
              {t('landing.faqTitle')}
            </h2>
            <p className="text-muted-foreground">
              {t('landing.faqDesc')}
            </p>
          </div>

          <Accordion type="single" collapsible className="w-full">
            {faqItems.map((item, index) => (
              <AccordionItem key={index} value={`item-${index}`} id={item.id}>
                <AccordionTrigger className="text-left">
                  {item.question}
                </AccordionTrigger>
                <AccordionContent className="text-muted-foreground">
                  {item.answer}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </section>

      {/* CTA Footer Section */}
      <section className="border-t border-border px-6 py-20">
        <div className="mx-auto flex max-w-2xl flex-col items-center text-center">
          <h2 className="mb-4 text-2xl font-bold sm:text-3xl">
            {t('landing.ctaTitle')}
          </h2>
          <p className="mb-8 text-muted-foreground">
            {t('landing.ctaDesc')}
          </p>
          <div className="flex flex-col items-center gap-4 sm:flex-row">
            <Button asChild size="lg" className="gap-2 px-8">
              <Link to="/projects">
                {t('landing.startEditing')}
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>

            <Button asChild variant="outline" size="lg" className="gap-2">
              <a
                href="https://github.com/20aaaaaaaaaaaaaaaaaaaa/webFrame"
                target="_blank"
                rel="noopener noreferrer"
              >
                <Star className="h-4 w-4" />
                {t('landing.starGithub')}
              </a>
            </Button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border px-6 py-8">
        <div className="mx-auto max-w-5xl text-center text-sm text-muted-foreground">
          MIT License © {new Date().getFullYear()} webFrame
        </div>
      </footer>
    </div>
  );
}
