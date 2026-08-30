package handlers

import "testing"

func TestEnrichAppInfoFillsPlaceholders(t *testing.T) {
	info := AppInfo{
		Name:      "test",
		Version:   "dev",
		BuildTime: "unknown",
		GitCommit: "none",
	}
	EnrichAppInfo(&info)
	if isBuildPlaceholder(info.GitCommit) {
		t.Fatalf("gitCommit still placeholder: %q", info.GitCommit)
	}
	if isBuildPlaceholder(info.BuildTime) {
		t.Fatalf("buildTime still placeholder: %q", info.BuildTime)
	}
	if isBuildPlaceholder(info.Version) {
		t.Fatalf("version still placeholder: %q", info.Version)
	}
}
