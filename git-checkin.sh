#!/bin/bash

echo "Git Check-in Helper"
echo "==================="
echo ""

# First, show the current status
echo "Current git status:"
echo "------------------"
git status

echo ""
echo "Suggested commit message:"
echo "------------------------"
echo "Fix MCP server protocol issues and improve error handling"
echo ""
echo "- Fixed Zod validation errors during Claude startup"
echo "- Improved JSON-RPC protocol compliance"
echo "- Added proper error response handling"
echo "- Enhanced initialization sequence"
echo "- Added debug tools and test scripts"
echo "- Updated documentation with troubleshooting guide"
echo ""

# Ask if user wants to proceed
read -p "Do you want to add all files and commit? (y/N): " answer

if [ "$answer" = "y" ] || [ "$answer" = "Y" ]; then
    echo ""
    echo "Adding files..."
    git add .
    
    echo ""
    echo "Creating commit..."
    git commit -m "Fix MCP server protocol issues and improve error handling

- Fixed Zod validation errors during Claude startup
- Improved JSON-RPC protocol compliance  
- Added proper error response handling
- Enhanced initialization sequence
- Added debug tools and test scripts
- Updated documentation with troubleshooting guide"
    
    echo ""
    echo "Commit created successfully!"
    echo ""
    echo "To push to remote repository, run:"
    echo "  git push origin main"
else
    echo "Check-in cancelled."
fi
