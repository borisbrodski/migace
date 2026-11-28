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

    /** The statements of a script: those before the line "-- @migace finally", and those after it, which are sent in any case. */
    static final class Parts {
        final List<Statement> main;
        final List<Statement> always;

        Parts(List<Statement> main, List<Statement> always) {
            this.main = main;
            this.always = always;
        }
    }

    private Script() {
    }

    /** Reads the statements of a script. Throws before anything can be sent if the text is no script of a known format. */
    static Parts read(String text) {
        String[] lines = text.replace("\r\n", "\n").split("\n", -1);
        Matcher first = FIRST_LINE.matcher(lines[0]);
        if (!first.matches()) {
            throw refused("This is no migration script: its first line is not \"-- @migace script format=…\".");
        }
        if (Integer.parseInt(first.group(1)) != FORMAT) {
            throw refused("This runner reads the script format " + FORMAT + ". The script has the format " + first.group(1) + ".");
        }
        List<Statement> statements = new ArrayList<>();
        int finallyAt = -1;
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
            if (isMarker && !nextKind.equals("statement") && !nextKind.equals("guard") && !nextKind.equals("finally")) {
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
            if ("finally".equals(nextKind)) {
                if (finallyAt >= 0) {
                    throw refused("Line " + (index + 1) + ": a second \"-- @migace finally\". A script has it at most once.");
                }
                finallyAt = statements.size();
                kind = null;
            } else if (isMarker) {
                kind = nextKind;
                Matcher labelled = LABEL.matcher(marker.group(2));
                label = labelled.find() ? labelled.group(1) : null;
                markerLine = index + 1;
                body.setLength(0);
            }
        }
        if (finallyAt < 0) {
            return new Parts(statements, new ArrayList<>());
        }
        return new Parts(statements.subList(0, finallyAt), statements.subList(finallyAt, statements.size()));
    }

    private static MigrationFailedException refused(String message) {
        return new MigrationFailedException(message, null, true, null);
    }
}
