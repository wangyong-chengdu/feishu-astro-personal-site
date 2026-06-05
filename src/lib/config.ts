import { readFileSync } from "node:fs";
import { join } from "node:path";
import YAML from "yaml";

type NavItem = {
  label: string;
  href: string;
};

type Category = {
  id: string;
  name: string;
  description: string;
};

type SiteConfig = {
  title: string;
  description: string;
  base_url: string;
  language: string;
  author: {
    name: string;
    bio: string;
  };
};

type HomepageConfig = {
  hero: {
    title: string;
    subtitle: string;
  };
  sections: Array<{
    type: string;
    title: string;
    limit?: number;
    slugs?: string[];
  }>;
};

type SocialConfig = {
  links: Array<{
    label: string;
    href: string;
  }>;
};

const root = process.cwd();

export function loadYamlFile<T>(path: string): T {
  const raw = readFileSync(join(root, path), "utf8");
  return YAML.parse(raw) as T;
}

export function getSiteConfig(): SiteConfig {
  return loadYamlFile<SiteConfig>("content-config/site.yml");
}

export function getNavigation(): NavItem[] {
  return loadYamlFile<{ items: NavItem[] }>("content-config/navigation.yml").items;
}

export function getCategories(): Category[] {
  return loadYamlFile<{ categories: Category[] }>("content-config/categories.yml").categories;
}

export function getHomepageConfig(): HomepageConfig {
  return loadYamlFile<HomepageConfig>("content-config/homepage.yml");
}

export function getSocialConfig(): SocialConfig {
  return loadYamlFile<SocialConfig>("content-config/social.yml");
}
