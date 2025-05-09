echo "# extracting '$1' to '$2'"
echo "# mkdir '$2'"
mkdir -p $2
echo "# unzip '$1'"
unzip $1 -d $2
echo "# unzip $2/**/data.zip"
find $2 -name 'data.zip' -exec sh -c 'unzip -o -d "${1%/*}" "$1"' _ {} \;
echo "# delete $2/**/data.zip"
find $2 -name 'data.zip' -type f -delete
echo "# rename $2/**/*_content to rename $2/**/*_content.zip"
find $2 -name '*_content' -type f -exec sh -c 'mv "$1" "$1.zip"' _ {} \;
echo "# unzip $2/**/*_content.zip"
find $2 -name '*_content.zip' -exec sh -c 'unzip -o -d "${1%.*}" "$1"' _ {} \;
echo "# delete $2/**/*_content.zip"
find $2 -name '*_content.zip' -type f -delete
echo "# decode $2/**/contentmetadata.md"
find $2 -name 'contentmetadata.md' -exec sh -c 'cat "$1" | base64 --decode > "$1.prop"' _ {} \;
echo "# decode $2/**/resources.cnt"
find $2 -name 'resources.cnt' -exec sh -c 'cat "$1" | base64 --decode | jq "." > "$1.json"' _ {} \;