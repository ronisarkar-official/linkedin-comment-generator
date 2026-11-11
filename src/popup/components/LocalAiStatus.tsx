import React, { useEffect, useState, useCallback } from 'react';
import {
	Check,
	CheckCircle2,
	Copy,
	Cpu,
	Loader2,
	RotateCw,
	Server,
	ShieldCheck,
	Terminal,
	Zap,
} from 'lucide-react';
import type { LlmProvider } from '../../lib/types';
import {
	LOCAL_MODEL_PRESETS,
	LocalModelPreset,
	LocalProbeResult,
	getLaunchCommand,
	inferServerType,
	probeLocalServer,
} from '../../lib/llm/local-probe';

interface LocalAiStatusProps {
	provider: LlmProvider;
	customApiBase?: string;
	selectedModel: string;
	onSelectModel: (model: string) => void;
	onProbeSuccess?: (result: LocalProbeResult) => void;
}

export const LocalAiStatus: React.FC<LocalAiStatusProps> = ({
	provider,
	customApiBase,
	selectedModel,
	onSelectModel,
	onProbeSuccess,
}) => {
	const [probing, setProbing] = useState<boolean>(false);
	const [probeResult, setProbeResult] = useState<LocalProbeResult | null>(null);
	const [copiedCommand, setCopiedCommand] = useState<string | null>(null);
	const [activePresetTag, setActivePresetTag] = useState<string>(
		selectedModel || 'llama3.2:3b',
	);

	const targetUrl =
		provider === 'ollama'
			? customApiBase || 'http://localhost:11434/v1'
			: customApiBase || 'http://localhost:4096';

	const serverType = inferServerType(targetUrl);

	const runProbe = useCallback(async () => {
		setProbing(true);
		try {
			const result = await probeLocalServer(targetUrl, 2500);
			setProbeResult(result);
			if (result.ok && onProbeSuccess) {
				onProbeSuccess(result);
			}
		} finally {
			setProbing(false);
		}
	}, [targetUrl, onProbeSuccess]);

	useEffect(() => {
		void runProbe();
	}, [runProbe]);

	const handleCopy = (text: string) => {
		void navigator.clipboard.writeText(text);
		setCopiedCommand(text);
		setTimeout(() => setCopiedCommand(null), 2000);
	};

	const handlePresetClick = (preset: LocalModelPreset) => {
		setActivePresetTag(preset.tag);
		onSelectModel(preset.tag);
	};

	const launchCmd = getLaunchCommand(serverType, activePresetTag);

	return (
		<div className="space-y-2.5 rounded-xl border border-border/80 bg-muted/30 p-3 shadow-2xs transition-colors">
			{/* Header Status Bar */}
			<div className="flex items-center justify-between gap-2">
				<div className="flex items-center gap-2 min-w-0">
					<div className="relative flex h-2.5 w-2.5 items-center justify-center">
						{probing ? (
							<span className="h-2 w-2 rounded-full bg-amber-400 animate-ping" />
						) : probeResult?.ok ? (
							<>
								<span className="absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75 animate-ping" />
								<span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500 ring-2 ring-emerald-500/20" />
							</>
						) : (
							<span className="relative inline-flex h-2 w-2 rounded-full bg-rose-500 ring-2 ring-rose-500/20" />
						)}
					</div>
					<div className="min-w-0">
						<div className="flex items-center gap-1.5 flex-wrap">
							<span className="text-xs font-bold text-foreground capitalize">
								{serverType === 'ollama'
									? 'Ollama Local'
									: serverType === 'lmstudio'
									? 'LM Studio'
									: serverType === 'opencode'
									? 'OpenCode'
									: 'Local Server'}
							</span>
							<span
								className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-semibold ${
									probing
										? 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
										: probeResult?.ok
										? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
										: 'bg-rose-500/10 text-rose-600 dark:text-rose-400'
								}`}>
								{probing
									? 'Probing…'
									: probeResult?.ok
									? `Online • ${probeResult.modelCount} ${
											probeResult.modelCount === 1 ? 'model' : 'models'
									  }${probeResult.latencyMs ? ` • ${probeResult.latencyMs}ms` : ''}`
									: 'Offline'}
							</span>
						</div>
					</div>
				</div>

				<button
					type="button"
					onClick={() => void runProbe()}
					disabled={probing}
					title="Re-check server connection"
					className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md border border-border/60 bg-background text-muted-foreground hover:bg-muted hover:text-foreground cursor-pointer transition-colors shadow-2xs disabled:opacity-50">
					<RotateCw
						className={`h-3 w-3 ${probing ? 'animate-spin text-primary' : ''}`}
					/>
				</button>
			</div>

			{/* Connected State: Detected Installed Models */}
			{probeResult?.ok && (
				<div className="space-y-1.5 pt-0.5">
					<div className="flex items-center justify-between text-[11px] text-muted-foreground">
						<span className="flex items-center gap-1 font-medium">
							<Cpu className="h-3 w-3 text-emerald-500" />
							Installed Local Models ({probeResult.models.length}):
						</span>
					</div>

					{probeResult.models.length > 0 ? (
						<div className="flex flex-wrap gap-1 max-h-24 overflow-y-auto pr-0.5">
							{probeResult.models.map((modId) => {
								const isSelected =
									selectedModel === modId ||
									selectedModel === modId.replace(/:latest$/, '') ||
									modId === `${selectedModel}:latest`;
								return (
									<button
										key={modId}
										type="button"
										onClick={() => onSelectModel(modId)}
										className={`group flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-mono cursor-pointer transition-all border ${
											isSelected
												? 'bg-primary text-primary-foreground border-primary font-semibold shadow-xs'
												: 'bg-background hover:bg-muted text-foreground border-border/70 hover:border-border'
										}`}>
										{isSelected && <Check className="h-2.5 w-2.5" />}
										<span className="truncate max-w-36">{modId}</span>
									</button>
								);
							})}
						</div>
					) : (
						<p className="text-[11px] text-muted-foreground italic">
							No models found on this instance. Pull a model below to get started.
						</p>
					)}
				</div>
			)}

			{/* Offline State: Guidance & 1-Click Launch Terminal Box */}
			{!probing && !probeResult?.ok && (
				<div className="space-y-2 rounded-lg border border-rose-500/20 bg-rose-500/5 p-2.5">
					<p className="text-[11px] leading-tight text-foreground font-medium">
						{serverType === 'ollama' ? (
							<>
								Ollama isn't running on port 11434. Start it via your terminal:
							</>
						) : serverType === 'lmstudio' ? (
							<>
								LM Studio server is offline. Click <strong>Local Server</strong>{' '}
								in LM Studio and click <strong>Start Server</strong> (port 1234).
							</>
						) : (
							<>
								Local service is not reachable at{' '}
								<code className="font-mono text-[10px] bg-background/80 px-1 py-0.5 rounded border border-border">
									{targetUrl}
								</code>
								. Start your server and click retry.
							</>
						)}
					</p>

					{serverType === 'ollama' && (
						<div className="relative flex items-center justify-between gap-1.5 rounded-md border border-input bg-background/90 px-2 py-1.5 font-mono text-[11px] text-foreground shadow-2xs">
							<div className="flex items-center gap-1.5 truncate">
								<Terminal className="h-3 w-3 shrink-0 text-muted-foreground" />
								<span className="truncate">{launchCmd}</span>
							</div>
							<button
								type="button"
								onClick={() => handleCopy(launchCmd)}
								className="flex items-center gap-1 shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold text-primary hover:bg-primary/10 transition-colors cursor-pointer">
								{copiedCommand === launchCmd ? (
									<>
										<Check className="h-3 w-3 text-emerald-500" />
										<span className="text-emerald-500">Copied</span>
									</>
								) : (
									<>
										<Copy className="h-3 w-3" />
										<span>Copy</span>
									</>
								)}
							</button>
						</div>
					)}
				</div>
			)}

			{/* 1-Click Recommended Lightweight Models */}
			<div className="space-y-1.5 pt-1 border-t border-border/50">
				<div className="flex items-center justify-between">
					<span className="flex items-center gap-1 text-[11px] font-semibold text-foreground">
						<Zap className="h-3 w-3 text-amber-500 fill-amber-500/20" />
						Recommended Lightweight Models:
					</span>
					<span className="text-[10px] text-muted-foreground font-medium">
						Optimized for comments
					</span>
				</div>

				<div className="grid grid-cols-2 gap-1.5">
					{LOCAL_MODEL_PRESETS.map((preset) => {
						const isSelected =
							selectedModel === preset.tag ||
							selectedModel.startsWith(preset.tag.split(':')[0]);
						return (
							<button
								key={preset.id}
								type="button"
								onClick={() => handlePresetClick(preset)}
								className={`flex flex-col text-left p-1.5 rounded-lg border transition-all cursor-pointer ${
									isSelected
										? 'border-primary/70 bg-primary/5 ring-1 ring-primary/20'
										: 'border-border/70 bg-background hover:bg-muted/60 hover:border-border'
								}`}>
								<div className="flex items-center justify-between gap-1">
									<span className="text-[11px] font-bold text-foreground truncate">
										{preset.name}
									</span>
									<span className="text-[9px] font-medium text-muted-foreground font-mono bg-muted px-1 py-0.2 rounded shrink-0">
										{preset.size}
									</span>
								</div>
								<p className="text-[10px] text-muted-foreground line-clamp-1 mt-0.5">
									{preset.recommendedFor}
								</p>
							</button>
						);
					})}
				</div>
			</div>

			{/* Privacy Guarantee Pill */}
			<div className="flex items-center gap-1.5 pt-0.5 text-[10px] text-emerald-600 dark:text-emerald-400 font-medium">
				<ShieldCheck className="h-3.5 w-3.5 shrink-0" />
				<span>100% Free & Private — Runs entirely on your local machine.</span>
			</div>
		</div>
	);
};

export default LocalAiStatus;

