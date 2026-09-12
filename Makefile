# Hellogmail - build tooling
#
# The compiled CSS is committed, so the server needs no Node. Run `make build`
# after editing anything under hellomail/styles/ and commit the resulting
# hellomail/styles/styles.css together with the LESS change.

RC_VERSION ?= 1.6.6
RC_TARBALL  = https://github.com/roundcube/roundcubemail/releases/download/$(RC_VERSION)/roundcubemail-$(RC_VERSION)-complete.tar.gz

BUILD    = build
RC_DIR   = $(BUILD)/roundcubemail-$(RC_VERSION)
ELASTIC  = $(BUILD)/skins/elastic
GMAILISH = $(BUILD)/skins/hellomail

.PHONY: build setup clean distclean elastic-diff icons

build: setup node_modules
	npm run --silent build
	@echo "Compiled all themes against Elastic $(RC_VERSION)"

# Replicates the on-server layout (skins/elastic next to skins/hellomail) so the
# relative @import in hellomail/styles/styles.less resolves during the build.
setup: $(ELASTIC) $(GMAILISH)

$(RC_DIR):
	mkdir -p $(BUILD)
	curl -sSL $(RC_TARBALL) | tar xz -C $(BUILD)

$(ELASTIC): | $(RC_DIR)
	mkdir -p $(BUILD)/skins
	ln -sfn ../roundcubemail-$(RC_VERSION)/skins/elastic $(ELASTIC)

$(GMAILISH):
	mkdir -p $(BUILD)/skins
	ln -sfn ../../hellomail $(GMAILISH)

node_modules: package.json
	npm install --no-audit --no-fund
	touch node_modules

# Show what changed in Elastic between the version the overrides were copied
# from and another version, e.g. `make elastic-diff FROM=1.6.6 TO=1.6.7`.
elastic-diff:
	@test -n "$(FROM)" -a -n "$(TO)" || (echo "usage: make elastic-diff FROM=1.6.6 TO=1.6.7"; exit 1)
	$(MAKE) --no-print-directory RC_VERSION=$(FROM) $(BUILD)/roundcubemail-$(FROM)
	$(MAKE) --no-print-directory RC_VERSION=$(TO) $(BUILD)/roundcubemail-$(TO)
	diff -ru $(BUILD)/roundcubemail-$(FROM)/skins/elastic $(BUILD)/roundcubemail-$(TO)/skins/elastic \
		--exclude='*.min.*' --exclude='*.css' || true

# Regenerate the icon fonts from Material Symbols (see tools/icons/build.py).
MS_BASE = https://raw.githubusercontent.com/google/material-design-icons/master/variablefont
MS_FILE = MaterialSymbolsOutlined%5BFILL%2CGRAD%2Copsz%2Cwght%5D
MS_DIR  = $(BUILD)/material-symbols

$(MS_DIR)/MaterialSymbolsOutlined.ttf:
	mkdir -p $(MS_DIR)
	curl -sSL -o $@ "$(MS_BASE)/$(MS_FILE).ttf"
	curl -sSL -o $(MS_DIR)/MaterialSymbolsOutlined.codepoints "$(MS_BASE)/$(MS_FILE).codepoints"

$(BUILD)/venv/bin/python:
	python3 -m venv $(BUILD)/venv
	$(BUILD)/venv/bin/pip install -q fonttools brotli

icons: $(RC_DIR) $(MS_DIR)/MaterialSymbolsOutlined.ttf $(BUILD)/venv/bin/python
	$(BUILD)/venv/bin/python tools/icons/build.py $(RC_DIR)/skins/elastic/styles $(MS_DIR)

clean:
	rm -f hellomail/styles/styles.css hellomail/styles/styles-*.css

distclean: clean
	rm -rf $(BUILD) node_modules
