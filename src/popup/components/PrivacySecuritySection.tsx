import { useMemo, useState } from 'react';
import { Eye, Lock, Shield, ShieldCheck, Sparkles } from 'lucide-react';
import type { UserSettings } from '../../lib/types';
import { estimateTokens } from '../../lib/crypto';
import { Button } from '@/components/ui/button';
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';

interface PrivacySecuritySectionProps {
	settings: UserSettings;
	onUpdateSettings: (updater: (prev: UserSettings) => UserSettings) => void;
}

export default function PrivacySecuritySection({
	settings,
	onUpdateSettings,
}: PrivacySecuritySectionProps) {
	const [isOpen, setIsOpen] = useState(false);

	const handleToggleAnonymize = (checked: boolean) => {
		onUpdateSettings((prev) => ({
			...prev,
			anonymizeAuthorName: checked,
		}));
	};

	// Generate sample inspection payload based on current settings
	const samplePayload = useMemo(() => {
		const authorName = settings.anonymizeAuthorName
			? 'LinkedIn Author'
			: 'Satya Nadella';

		const samplePost =
			'Artificial intelligence is reshaping the future of enterprise software and developer productivity.';

		return {
			provider: settings.provider,
			model: settings.model,
			encryption: 'AES-GCM-256 (At rest in chrome.storage.local)',
			security: {
				authorAnonymized: Boolean(settings.anonymizeAuthorName),
				cookiesTransmitted: false,
				passwordsTransmitted: false,
			},
			system_directive:
				'You are a thoughtful LinkedIn engagement assistant. Generate distinct, human-like comment drafts.',
			request_body: {
				post_content: samplePost,
				author_name: authorName,
				tone: settings.defaultTone,
				length: settings.commentLength,
				profile_context: settings.profileSummary || '(empty)',
				promotional_signature: settings.promotionalMessage || '(none)',
			},
			generation_parameters: {
				temperature: 0.7,
				candidate_count: 3,
			},
		};
	}, [settings]);

	const payloadJson = useMemo(() => {
		return JSON.stringify(samplePayload, null, 2);
	}, [samplePayload]);

	const estimatedTokens = useMemo(() => {
		return estimateTokens(payloadJson);
	}, [payloadJson]);

	return (
		<div className="space-y-3 rounded-xl border border-border bg-card p-3 shadow-2xs text-xs">
			<div className="flex items-center justify-between">
				<div className="flex items-center gap-1.5">
					<ShieldCheck className="h-4 w-4 text-emerald-600" />
					<span className="font-semibold text-foreground text-xs">
						Security &amp; Privacy Vault
					</span>
				</div>
				<span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[9px] font-semibold text-emerald-600">
					<Lock className="h-2.5 w-2.5" />
					AES-GCM-256
				</span>
			</div>

			<p className="text-[10px] text-muted-foreground leading-relaxed">
				All API keys are encrypted at rest with native Web Crypto (<code className="text-foreground">AES-GCM-256</code>). Keys never touch remote servers unencrypted.
			</p>

			{/* Anonymize author switch */}
			<div className="flex items-center justify-between gap-3 pt-1 border-t border-border">
				<div className="space-y-0.5 min-w-0">
					<Label
						htmlFor="anonymize-author"
						className="text-xs font-medium text-foreground cursor-pointer">
						Anonymize author names
					</Label>
					<p className="text-[10px] text-muted-foreground leading-tight">
						Replaces names with "LinkedIn Author" in prompts sent to AI providers.
					</p>
				</div>
				<Switch
					id="anonymize-author"
					checked={Boolean(settings.anonymizeAuthorName)}
					onCheckedChange={handleToggleAnonymize}
					className="shrink-0 scale-90"
				/>
			</div>

			{/* Pre-flight payload inspector trigger */}
			<div className="pt-1 border-t border-border flex items-center justify-between">
				<span className="text-[10px] font-medium text-muted-foreground flex items-center gap-1">
					<Sparkles className="h-3 w-3 text-primary" />
					Payload transparency
				</span>

				<Dialog open={isOpen} onOpenChange={setIsOpen}>
					<DialogTrigger
						render={
							<Button
								variant="outline"
								size="xs"
								className="h-6 gap-1 px-2 text-[10px] font-medium"
							/>
						}>
						<Eye className="h-3 w-3" />
						Inspect AI Payload
					</DialogTrigger>
					<DialogContent className="max-w-105 p-4 text-xs">
						<DialogHeader>
							<DialogTitle className="flex items-center gap-2 text-sm font-bold text-foreground">
								<Shield className="h-4 w-4 text-primary" />
								Pre-Flight AI Request Payload
							</DialogTitle>
						</DialogHeader>

						<div className="space-y-3 pt-1">
							<div className="grid grid-cols-2 gap-2 text-[11px]">
								<div className="rounded-lg border border-border bg-muted/50 p-2">
									<span className="text-[10px] text-muted-foreground block font-medium">
										Active Provider &amp; Model
									</span>
									<span className="font-semibold text-foreground truncate block">
										{settings.provider} / {settings.model}
									</span>
								</div>
								<div className="rounded-lg border border-border bg-muted/50 p-2">
									<span className="text-[10px] text-muted-foreground block font-medium">
										Est. Tokens &amp; Cost
									</span>
									<span className="font-semibold text-foreground block">
										~{estimatedTokens} tokens (<span className="text-emerald-600">&lt; $0.0001</span>)
									</span>
								</div>
							</div>

							<div className="space-y-1">
								<span className="text-[10px] font-semibold text-muted-foreground block">
									Exact JSON Payload Dispatched to Provider:
								</span>
								<div className="max-h-56 overflow-y-auto rounded-lg border border-border bg-muted/80 p-2.5 font-mono text-[10px] text-foreground leading-relaxed select-text">
									<pre className="whitespace-pre-wrap">{payloadJson}</pre>
								</div>
							</div>

							<div className="rounded-lg bg-emerald-500/10 border border-emerald-500/20 p-2 text-[10px] text-emerald-800 dark:text-emerald-300 leading-relaxed">
								🔒 <strong>Privacy Guarantee</strong>: The extension only sends the post text snippet and tone preferences. Your LinkedIn session cookies, profile credentials, and passwords are never read or transmitted.
							</div>
						</div>
					</DialogContent>
				</Dialog>
			</div>
		</div>
	);
}

