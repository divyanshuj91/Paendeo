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

##  How to Contribute

We welcome contributions from the developer community! To submit changes, please follow this workflow:

### 1. Repository Setup
1. Fork this repository to your own GitHub account.
2. Clone your fork locally.
3. Create a new branch for your feature or bug fix:
   ```bash
   git checkout -b feature/your-feature-name
   ```

### 2. Code Contribution Guidelines
- **Modularity**: Keep components, physics, and canvas render cycles decoupled.
- **Boilerplate Cleanliness**: Ensure configuration blocks (like frame rates and canvas sizes) are grouped at the top of their respective files for easy tweaking.
- **Assets**: If modifying or adding sprite assets, verify that background removal transparency maps cleanly and does not leave grid borders.

### 3. Submission
1. Commit your changes with clear, descriptive commit messages.
2. Push your branch to your GitHub fork:
   ```bash
   git push origin feature/your-feature-name
   ```
3. Open a **Pull Request (PR)** against the main branch of this repository. Provide a description of the changes made and any verification tests performed.
