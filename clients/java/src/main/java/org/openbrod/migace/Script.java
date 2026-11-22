package org.openbrod.migace;

import java.util.ArrayList;
import java.util.List;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/** A migration script as a list of statements. The format is described in clients/contract/README.md. */
final class Script {

    static final int FORMAT = 1;

    private static final Pattern FIRST_LINE = Pattern.compile("^-- @migace script format=(\\d+)$");
    private static final Pattern MARKER = Pattern.compile("^-- @migace (\\S+)(.*)$");
    private static final Pattern LABEL = Pattern.compile("label=\"([^\"]*)\"");

    /** One statement of a script, with the guard query that decides whether it is sent. */
    static final class Statement {
        final String sql;
        final String guard;
        final String label;
        final int line;

        Statement(String sql, String guard, String label, int line) {
            this.sql = sql;
            this.guard = guard;
            this.label = label;
            this.line = line;
        }
    }

    private Script() {
    }

    /** Reads the statements of a script. Throws before anything can be sent if the text is no script of a known format. */
    static List<Statement> read(String text) {
        String[] lines = text.replace("\r\n", "\n").split("\n", -1);
        Matcher first = FIRST_LINE.matcher(lines[0]);
        if (!first.matches()) {
            throw refused("This is no migration script: its first line is not \"-- @migace script format=…\".");
        }
        if (Integer.parseInt(first.group(1)) != FORMAT) {
            throw refused("This runner reads the script format " + FORMAT + ". The script has the format " + first.group(1) + ".");
        }
        List<Statement> statements = new ArrayList<>();
        String kind = null;
        String label = null;
        String guard = null;
        int markerLine = 0;
        StringBuilder body = new StringBuilder();
        for (int index = 1; index <= lines.length; index++) {
            String line = index < lines.length ? lines[index] : null;
            Matcher marker = line == null ? null : MARKER.matcher(line);
            boolean isMarker = marker != null && marker.matches();
            if (line != null && !isMarker) {
                if (kind != null) {
                    body.append(line).append('\n');
                } else if (!line.trim().isEmpty()) {
                    throw refused("Line " + (index + 1) + ": text outside a statement.");
                }
                continue;
            }
            String nextKind = isMarker ? marker.group(1) : null;
            if (isMarker && !nextKind.equals("statement") && !nextKind.equals("guard")) {
                throw refused("Line " + (index + 1) + ": unknown marker \"" + nextKind + "\".");
            }
            if ("guard".equals(kind) && !"statement".equals(nextKind)) {
                throw refused("Line " + markerLine + ": this guard is not followed by a statement.");
            }
            if ("guard".equals(kind)) {
                guard = body.toString().trim();
            } else if ("statement".equals(kind)) {
                statements.add(new Statement(body.toString().trim(), guard, label, markerLine));
                guard = null;
            }
            if (isMarker) {
                kind = nextKind;
                Matcher labelled = LABEL.matcher(marker.group(2));
                label = labelled.find() ? labelled.group(1) : null;
                markerLine = index + 1;
                body.setLength(0);
            }
        }
        return statements;
    }

    private static MigrationFailedException refused(String message) {
        return new MigrationFailedException(message, null, true, null);
    }
}
