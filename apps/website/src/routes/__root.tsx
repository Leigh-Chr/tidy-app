import { Button } from "@/components/button";
import { ModeToggle } from "@/components/mode-toggle";
import { ThemeProvider } from "@/components/theme-provider";
import { createRootRoute, HeadContent, Link, Outlet } from "@tanstack/react-router";
import { Download, FolderOpen, Github, Heart } from "lucide-react";

const BASE_URL = "https://leigh-chr.github.io/tidy-app";
const GITHUB_URL = "https://github.com/Leigh-Chr/tidy-app";
const RELEASES_URL = "https://github.com/Leigh-Chr/tidy-app/releases";

export const Route = createRootRoute({
	component: RootComponent,
	head: () => ({
		meta: [
			{
				title: "Tidy App - Intelligent File Organization",
			},
			{
				name: "description",
				content:
					"Tidy App - Intelligent file organization tool. Automatically rename, sort, and organize your files with smart patterns and metadata extraction.",
			},
			{ property: "og:type", content: "website" },
			{ property: "og:url", content: BASE_URL },
			{
				property: "og:title",
				content: "Tidy App - Intelligent File Organization",
			},
			{
				property: "og:description",
				content:
					"Intelligent file organization tool. Automatically rename, sort, and organize your files with smart patterns and metadata extraction.",
			},
			{ property: "og:locale", content: "en_US" },
			{ property: "og:site_name", content: "Tidy App" },
			{ name: "twitter:card", content: "summary_large_image" },
			{
				name: "twitter:title",
				content: "Tidy App - Intelligent File Organization",
			},
			{
				name: "twitter:description",
				content:
					"Intelligent file organization tool. Automatically rename, sort, and organize your files with smart patterns and metadata extraction.",
			},
			{ name: "theme-color", content: "#18181b" },
		],
		links: [{ rel: "canonical", href: BASE_URL }],
		scripts: [
			{
				type: "application/ld+json",
				children: JSON.stringify({
					"@context": "https://schema.org",
					"@type": "SoftwareApplication",
					name: "Tidy App",
					url: BASE_URL,
					description:
						"Intelligent file organization tool for Windows, macOS, and Linux.",
					applicationCategory: "UtilitiesApplication",
					operatingSystem: ["Windows", "macOS", "Linux"],
					offers: {
						"@type": "Offer",
						price: "0",
						priceCurrency: "EUR",
					},
				}),
			},
		],
	}),
});

function RootComponent() {
	return (
		<>
			<HeadContent />
			<ThemeProvider defaultTheme="system" storageKey="tidy-theme">
				<a
					href="#main-content"
					className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-[100] focus:rounded-md focus:bg-primary focus:px-4 focus:py-2 focus:text-primary-foreground focus:outline-none focus:ring-2 focus:ring-ring"
				>
					Skip to main content
				</a>
				<div className="flex min-h-svh flex-col">
					<Header />
					<main id="main-content" className="flex-1" tabIndex={-1}>
						<Outlet />
					</main>
					<Footer />
				</div>
			</ThemeProvider>
		</>
	);
}

function Header() {
	return (
		<header className="header-glow sticky top-0 z-50 border-b bg-background/95 backdrop-blur-md supports-[backdrop-filter]:bg-background/80">
			<div className="container flex items-center justify-between px-4 py-3">
				{/* Logo */}
				<Link
					to="/"
					className="logo-animated group flex items-center gap-2.5 rounded-md font-semibold text-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
					aria-label="Tidy App - Home"
				>
					<div className="relative">
						<FolderOpen
							className="logo-icon size-5 text-primary"
							aria-hidden="true"
						/>
						<div className="absolute inset-0 rounded-full bg-primary/20 opacity-0 blur-md transition-opacity group-hover:opacity-100" />
					</div>
					<span className="bg-gradient-to-r from-foreground to-foreground/80 bg-clip-text">
						Tidy App
					</span>
				</Link>

				{/* Desktop navigation */}
				<nav
					className="hidden items-center gap-6 md:flex"
					aria-label="Main navigation"
				>
					<a
						href={RELEASES_URL}
						className="flex items-center gap-2 rounded-sm font-medium text-muted-foreground text-sm transition-colors hover:text-foreground focus-visible:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
					>
						<Download className="size-4" aria-hidden="true" />
						Download
					</a>
					<div className="mx-2 h-4 w-px bg-border" />
					<a
						href={GITHUB_URL}
						target="_blank"
						rel="noopener noreferrer"
						className="flex items-center gap-2 rounded-sm font-medium text-muted-foreground text-sm transition-colors hover:text-foreground focus-visible:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
					>
						<Github className="size-4" aria-hidden="true" />
						GitHub
					</a>
				</nav>

				{/* Right side actions */}
				<div className="flex items-center gap-2">
					<ModeToggle />

					{/* Mobile menu - simplified for single product */}
					<div className="md:hidden">
						<Button variant="ghost" size="icon" className="min-h-[44px] min-w-[44px]" asChild>
							<a href={RELEASES_URL}>
								<Download className="size-5" />
								<span className="sr-only">Download</span>
							</a>
						</Button>
					</div>
				</div>
			</div>
		</header>
	);
}

function Footer() {
	const currentYear = new Date().getFullYear();

	return (
		<footer className="border-t bg-muted/30">
			<div className="container mx-auto px-4 py-8">
				<div className="grid grid-cols-1 gap-8 md:grid-cols-3">
					{/* Brand section */}
					<div className="space-y-3">
						<div className="flex items-center gap-2">
							<FolderOpen className="size-5 text-primary" aria-hidden="true" />
							<p className="font-semibold text-base">Tidy App</p>
						</div>
						<p className="text-muted-foreground text-sm">
							Intelligent file organization tool. Automatically rename, sort,
							and organize your files.
						</p>
					</div>

					{/* Downloads section */}
					<div className="space-y-3">
						<p className="font-semibold text-base">Downloads</p>
						<ul className="space-y-2">
							<li>
								<a
									href={RELEASES_URL}
									className="flex items-center gap-2 text-muted-foreground text-sm transition-colors hover:text-foreground"
								>
									<Download className="size-4" aria-hidden="true" />
									All Releases
								</a>
							</li>
						</ul>
					</div>

					{/* Legal & Links section */}
					<div className="space-y-3">
						<p className="font-semibold text-base">Links</p>
						<ul className="space-y-2">
							<li>
								<a
									href={GITHUB_URL}
									target="_blank"
									rel="noopener noreferrer"
									className="flex items-center gap-2 text-muted-foreground text-sm transition-colors hover:text-foreground"
								>
									<Github className="size-4" aria-hidden="true" />
									GitHub
									<span className="sr-only">(opens in new tab)</span>
								</a>
							</li>
							<li>
								<a
									href="https://ko-fi.com/leigh_chr"
									target="_blank"
									rel="noopener noreferrer"
									className="flex items-center gap-2 text-muted-foreground text-sm transition-colors hover:text-primary"
								>
									<Heart
										className="size-4 fill-current text-primary/70"
										aria-hidden="true"
									/>
									Support on Ko-fi
									<span className="sr-only">(opens in new tab)</span>
								</a>
							</li>
							<li>
								<a
									href={`${GITHUB_URL}/blob/main/LICENSE`}
									target="_blank"
									rel="noopener noreferrer"
									className="text-muted-foreground text-sm transition-colors hover:text-foreground"
								>
									License (MIT)
									<span className="sr-only"> (opens in new tab)</span>
								</a>
							</li>
						</ul>
					</div>
				</div>

				{/* Copyright */}
				<div className="mt-8 border-t pt-6 text-center">
					<p className="text-muted-foreground text-sm">
						© {currentYear} Tidy App. Open source and free to use.
					</p>
				</div>
			</div>
		</footer>
	);
}
