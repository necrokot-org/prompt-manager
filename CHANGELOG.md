# Change Log

All notable changes to the "prompt-manager" extension will be documented in this file.

Check [Keep a Changelog](http://keepachangelog.com/) for recommendations on how to structure this file.

## [Unreleased]

### Changed

- Environment-aware "Ask AI" button visibility - now only shown in VS Code environment where Chat panel API is available

### Technical

- Updated package.json menu contribution for `promptManager.askAiWithPrompt` with environment-specific `when` clause

- Initial release
