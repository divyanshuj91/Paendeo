# Developer Guide

This document explains how to launch the application locally and details the guidelines for contributing to this repository.

---

##  How to Launch

Follow these steps to set up and run the application on your local machine:

### Prerequisites
- [Node.js](https://nodejs.org/) (v16 or higher)
- [npm](https://www.npmjs.com/) (installed automatically with Node.js)

### Installation
1. Clone the repository to your local machine.
2. Navigate to the project root directory in your terminal and install the dependencies:
   ```bash
   npm install
   ```

### Running the Application
Start the application by running:
   ```bash
   npm start
   ```

---

## 🤝 How to Contribute

We welcome contributions! To maintain security and repository integrity, please adhere strictly to the following contribution workflow.

> [!IMPORTANT]
> **Repository Security Guidelines**:
> 1. **No Direct Commits**: Developers must fork and clone the repository. Direct pushes to the `main` branch are restricted.
> 2. **Pull Requests Only**: All features, patches, and bug fixes must be submitted via a Pull Request (PR) for review.
> 3. **No Force Pushing**: Force pushes (`git push --force` or `git push -f`) to the upstream repository branches are strictly prohibited.

### Contribution Workflow

1. **Fork and Clone**:
   Fork the repository to your own GitHub account, then clone your fork locally:
   ```bash
   git clone https://github.com/your-username/Paendeo.git
   ```

2. **Branching**:
   Create a dedicated branch for your change:
   ```bash
   git checkout -b feature/your-feature-name
   ```

3. **Coding Standards**:
   - Keep code modular and decouple layout components from rendering cycles.
   - Maintain configuration values in designated configs at the top of files.
   - Clean custom sprite sheet grids of background artifacts using the cleaning script.

4. **Submission**:
   - Push commits to your fork:
     ```bash
     git push origin feature/your-feature-name
     ```
   - Open a **Pull Request (PR)** from your fork's feature branch to this upstream repository's `main` branch. 
   - Direct force-commits or force-pushes targeting remote branches on this repository are blocked by repository rules.
