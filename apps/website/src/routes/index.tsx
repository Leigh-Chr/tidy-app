import { Button } from "@/components/button";
import { createFileRoute } from "@tanstack/react-router";
import {
	ArrowRight,
	Download,
	FolderOpen,
	Github,
	Globe,
	Heart,
	Image,
	Lock,
	Sparkles,
	Tags,
	Undo2,
	Zap,
} from "lucide-react";

export const Route = createFileRoute("/")({
	component: LandingPage,
});

const GITHUB_URL = "https://github.com/Leigh-Chr/tidy-app";
const RELEASES_URL = "https://github.com/Leigh-Chr/tidy-app/releases";

const features = [
	{
		icon: Tags,
		title: "Smart Patterns",
		description:
			"Create custom renaming templates with variables like date, counter, and original name.",
	},
	{
		icon: Image,
		title: "Metadata Extraction",
		description:
			"Extract EXIF data from photos, metadata from PDFs and Office documents automatically.",
	},
	{
		icon: FolderOpen,
		title: "Batch Processing",
		description:
			"Organize hundreds of files at once with preview before applying changes.",
	},
	{
		icon: Undo2,
		title: "Undo Support",
		description:
			"Made a mistake? Full operation history lets you undo any rename operation.",
	},
	{
		icon: Lock,
		title: "Privacy First",
		description:
			"All processing happens locally. Your files never leave your computer.",
	},
	{
		icon: Globe,
		title: "Open Source",
		description:
			"Free and open source under MIT license. Audit the code or contribute.",
	},
];

const platforms = [
	{
		name: "Windows",
		description: "Windows 10 and later",
		formats: ["MSI", "NSIS"],
	},
	{
		name: "macOS",
		description: "macOS 11 and later",
		formats: ["DMG (Intel & Apple Silicon)"],
	},
	{
		name: "Linux",
		description: "Modern distributions",
		formats: ["AppImage", "DEB", "RPM"],
	},
];

function LandingPage() {
	return (
		<div className="flex flex-col">
			{/* Hero Section */}
			<section
				className="relative isolate overflow-hidden"
				aria-labelledby="hero-heading"
			>
				{/* Background effects */}
				<div className="pointer-events-none absolute inset-0 -z-10">
					<div className="aurora absolute inset-0" />
					<div className="dot-grid absolute inset-0 opacity-50 [mask-image:radial-gradient(ellipse_80%_60%_at_50%_0%,#000_60%,transparent_100%)]" />
					<div className="absolute top-0 left-1/2 h-[600px] w-[900px] -translate-x-1/2 rounded-full bg-primary/8 blur-[120px]" />
					<div className="absolute top-20 left-[20%] h-[300px] w-[300px] rounded-full bg-chart-3/10 blur-[80px]" />
					<div className="noise-overlay absolute inset-0" />
				</div>

				<div className="container mx-auto px-4 py-16 sm:py-24 md:py-32">
					<div className="mx-auto max-w-4xl text-center">
						{/* Badge */}
						<div className="fade-in slide-in-from-bottom-3 mb-8 inline-flex animate-in items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-4 py-2 text-small duration-500">
							<Sparkles className="size-4 text-primary" aria-hidden="true" />
							<span className="text-foreground/80">
								Free & Open Source • Cross-Platform • Privacy First
							</span>
						</div>

						{/* Main heading */}
						<h1
							id="hero-heading"
							className="fade-in slide-in-from-bottom-4 mb-6 animate-in text-hero duration-700"
						>
							Organize your files,
							<br />
							<span className="bg-gradient-to-r from-primary via-primary/90 to-primary bg-clip-text text-transparent">
								effortlessly
							</span>
						</h1>

						{/* Subtitle */}
						<p className="fade-in slide-in-from-bottom-5 mx-auto mb-10 max-w-2xl animate-in text-body-large text-muted-foreground duration-1000">
							Intelligent file organization tool that{" "}
							<span className="font-medium text-foreground">renames</span>,{" "}
							<span className="font-medium text-foreground">sorts</span>, and{" "}
							<span className="font-medium text-foreground">organizes</span>{" "}
							your files using smart patterns and metadata extraction.
						</p>

						{/* CTA buttons */}
						<div className="fade-in slide-in-from-bottom-6 flex animate-in flex-col items-center justify-center gap-4 duration-1000 sm:flex-row">
							<Button size="lg" className="group h-12 gap-2 px-8" asChild>
								<a href={RELEASES_URL}>
									<Download className="size-4" aria-hidden="true" />
									Download for Free
									<ArrowRight
										className="size-4 transition-transform group-hover:translate-x-1"
										aria-hidden="true"
									/>
								</a>
							</Button>
							<Button
								size="lg"
								variant="outline"
								className="h-12 gap-2"
								asChild
							>
								<a href={GITHUB_URL} target="_blank" rel="noopener noreferrer">
									<Github className="size-4" aria-hidden="true" />
									View on GitHub
									<span className="sr-only">(opens in new tab)</span>
								</a>
							</Button>
						</div>

						{/* Trust indicators */}
						<div className="fade-in mt-14 flex animate-in flex-wrap items-center justify-center gap-x-8 gap-y-4 text-muted-foreground text-small duration-1000">
							<div className="flex items-center gap-2.5">
								<Lock className="size-4 text-primary/70" aria-hidden="true" />
								<span>100% local processing</span>
							</div>
							<div className="flex items-center gap-2.5">
								<Zap className="size-4 text-primary/70" aria-hidden="true" />
								<span>Fast & lightweight</span>
							</div>
							<div className="flex items-center gap-2.5">
								<Globe className="size-4 text-primary/70" aria-hidden="true" />
								<span>Windows, macOS & Linux</span>
							</div>
						</div>
					</div>
				</div>
			</section>

			{/* Features Section */}
			<section
				className="section-divider relative"
				aria-labelledby="features-heading"
			>
				<div className="pointer-events-none absolute inset-0 -z-10">
					<div className="gradient-mesh grain-texture absolute inset-0 opacity-40" />
				</div>

				<div className="container mx-auto px-4 py-20 sm:py-24">
					<div className="mx-auto mb-16 max-w-2xl text-center">
						<h2 id="features-heading" className="mb-6 text-display">
							Powerful features
						</h2>
						<p className="text-body-large text-muted-foreground">
							Everything you need to keep your files organized and easy to find.
						</p>
					</div>

					<div className="mx-auto grid max-w-5xl gap-4 sm:grid-cols-2 lg:grid-cols-3">
						{features.map((feature, index) => (
							<FeatureCard
								key={feature.title}
								feature={feature}
								delay={index * 50}
							/>
						))}
					</div>
				</div>
			</section>

			{/* How It Works Section */}
			<section
				className="section-divider relative overflow-hidden bg-muted/30"
				aria-labelledby="how-it-works-heading"
			>
				<div className="pointer-events-none absolute inset-0 -z-10">
					<div className="cross-grid absolute inset-0 opacity-20" />
					<div className="grain-texture absolute inset-0" />
				</div>

				<div className="container mx-auto px-4 py-20 sm:py-24">
					<div className="mx-auto mb-12 max-w-2xl text-center">
						<h2 id="how-it-works-heading" className="mb-6 text-display">
							How it works
						</h2>
						<p className="text-body-large text-muted-foreground">
							Three simple steps to organized files.
						</p>
					</div>

					<div className="mx-auto grid max-w-4xl gap-8 md:grid-cols-3">
						<StepCard
							number="01"
							title="Drop your files"
							description="Drag and drop a folder or select files to organize."
							delay={0}
						/>
						<StepCard
							number="02"
							title="Preview changes"
							description="See exactly how files will be renamed before applying."
							delay={100}
						/>
						<StepCard
							number="03"
							title="Apply & done"
							description="One click to rename. Undo anytime if needed."
							delay={200}
						/>
					</div>
				</div>
			</section>

			{/* Platforms Section */}
			<section
				className="section-divider relative"
				aria-labelledby="platforms-heading"
			>
				<div className="pointer-events-none absolute inset-0 -z-10">
					<div className="gradient-mesh grain-texture absolute inset-0 opacity-30" />
				</div>

				<div className="container mx-auto px-4 py-20 sm:py-24">
					<div className="mx-auto mb-16 max-w-2xl text-center">
						<h2 id="platforms-heading" className="mb-6 text-display">
							Available everywhere
						</h2>
						<p className="text-body-large text-muted-foreground">
							Native desktop app for all major platforms.
						</p>
					</div>

					<div className="mx-auto grid max-w-4xl gap-6 md:grid-cols-3">
						{platforms.map((platform, index) => (
							<PlatformCard
								key={platform.name}
								platform={platform}
								delay={index * 100}
							/>
						))}
					</div>
				</div>
			</section>

			{/* Final CTA Section */}
			<section
				className="section-divider relative overflow-hidden"
				aria-labelledby="cta-heading"
			>
				<div className="pointer-events-none absolute inset-0 -z-10">
					<div className="aurora absolute inset-0 opacity-70" />
					<div className="absolute top-1/2 left-1/2 h-[400px] w-[600px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/10 blur-[100px]" />
					<div className="dot-grid absolute inset-0 opacity-30 [mask-image:radial-gradient(ellipse_60%_60%_at_50%_50%,#000_40%,transparent_100%)]" />
				</div>

				<div className="container mx-auto px-4 py-20 sm:py-24">
					<div className="mx-auto max-w-2xl text-center">
						<h2 id="cta-heading" className="mb-6 text-display">
							Ready to get organized?
						</h2>
						<p className="mb-10 text-body-large text-muted-foreground">
							Download Tidy App today. Free, open source, and respects your
							privacy.
						</p>
						<div className="flex flex-col items-center justify-center gap-4 sm:flex-row">
							<Button size="lg" className="group h-12 gap-2 px-8" asChild>
								<a href={RELEASES_URL}>
									<Download className="size-4" aria-hidden="true" />
									Download Now
									<ArrowRight
										className="size-4 transition-transform group-hover:translate-x-1"
										aria-hidden="true"
									/>
								</a>
							</Button>
							<Button
								size="lg"
								variant="outline"
								className="h-12 gap-2"
								asChild
							>
								<a href={GITHUB_URL} target="_blank" rel="noopener noreferrer">
									<Heart className="size-4" aria-hidden="true" />
									Star on GitHub
									<span className="sr-only">(opens in new tab)</span>
								</a>
							</Button>
						</div>
					</div>
				</div>
			</section>
		</div>
	);
}

interface Feature {
	icon: React.ComponentType<{ className?: string }>;
	title: string;
	description: string;
}

function FeatureCard({ feature, delay }: { feature: Feature; delay: number }) {
	const Icon = feature.icon;

	return (
		<article
			className="group fade-in slide-in-from-bottom-4 relative animate-in overflow-hidden rounded-xl border bg-card p-6 transition-all duration-200 hover:-translate-y-1 hover:border-primary/40 hover:shadow-lg"
			style={{ animationDelay: `${delay}ms`, animationFillMode: "backwards" }}
		>
			<div className="pointer-events-none absolute inset-0 rounded-xl bg-gradient-to-br from-primary/8 via-transparent to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
			<div className="relative">
				<div className="mb-4 inline-flex size-11 items-center justify-center rounded-lg bg-muted transition-all duration-200 group-hover:scale-110 group-hover:bg-primary/15 group-hover:shadow-lg group-hover:shadow-primary/20">
					<Icon
						className="size-5 text-muted-foreground transition-colors duration-200 group-hover:text-primary"
						aria-hidden="true"
					/>
				</div>
				<h3 className="mb-3 text-heading-3">{feature.title}</h3>
				<p className="text-body text-muted-foreground">{feature.description}</p>
			</div>
		</article>
	);
}

function StepCard({
	number,
	title,
	description,
	delay = 0,
}: {
	number: string;
	title: string;
	description: string;
	delay?: number;
}) {
	return (
		<div
			className="group fade-in slide-in-from-bottom-4 relative animate-in text-center"
			style={{ animationDelay: `${delay}ms`, animationFillMode: "backwards" }}
		>
			<div
				className="step-number mb-4 text-6xl transition-all duration-300 group-hover:scale-110 sm:text-7xl"
				aria-hidden="true"
			>
				{number}
			</div>
			<div className="mx-auto mb-4 h-1 w-16 rounded-full bg-gradient-to-r from-transparent via-primary/30 to-transparent transition-all duration-300 group-hover:w-24 group-hover:via-primary/50" />
			<h3 className="mb-3 text-heading-3">{title}</h3>
			<p className="text-body text-muted-foreground">{description}</p>
		</div>
	);
}

interface Platform {
	name: string;
	description: string;
	formats: string[];
}

function PlatformCard({
	platform,
	delay,
}: {
	platform: Platform;
	delay: number;
}) {
	return (
		<article
			className="group fade-in slide-in-from-bottom-4 relative animate-in overflow-hidden rounded-xl border bg-card p-6 text-center transition-all duration-200 hover:-translate-y-1 hover:border-primary/40 hover:shadow-lg"
			style={{ animationDelay: `${delay}ms`, animationFillMode: "backwards" }}
		>
			<div className="pointer-events-none absolute inset-0 rounded-xl bg-gradient-to-br from-primary/8 via-transparent to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
			<div className="relative">
				<h3 className="mb-2 text-heading-3">{platform.name}</h3>
				<p className="mb-4 text-muted-foreground text-small">
					{platform.description}
				</p>
				<div className="flex flex-wrap justify-center gap-2">
					{platform.formats.map((format) => (
						<span
							key={format}
							className="rounded-full bg-muted px-3 py-1 text-muted-foreground text-xs"
						>
							{format}
						</span>
					))}
				</div>
			</div>
		</article>
	);
}
