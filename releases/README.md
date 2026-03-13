# PhotoViewer Releases

This folder contains information about the latest PhotoViewer builds.

## Latest Version: 1.0.0 (macOS)

The application is distributed as a macOS `.dmg` installer. Due to size constraints, the binary is hosted on GitHub Releases for faster downloads.

### 📥 [Download Latest Release](https://github.com/schaud14/PhotoViewer/releases)

---

## Technical Details (For Maintainers)

The application is built using `electron-builder`. 
- **Target**: Apple Silicon (arm64)
- **Format**: DMG
- **Models**: Bundled inside `PhotoViewer.app/Contents/Resources/models`

### To upload a new build:
1. Ensure you have the GitHub CLI installed: `brew install gh`
2. Run: `gh release create v1.0.0 dist/PhotoViewer-1.0.0-arm64.dmg --title "Initial Release" --notes "First public build of PhotoViewer"`
