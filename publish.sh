npm version patch
set VAR=%version%

git commit -m %version%
git push

npm publish --access public
