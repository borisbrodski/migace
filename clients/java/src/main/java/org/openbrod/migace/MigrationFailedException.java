package org.openbrod.migace;

/**
 * A migration script did not run to its end.
 *
 * <p>The message is the one of the script. For a part that failed it names the snippet and the part
 * and carries the message of the database.
 */
public class MigrationFailedException extends RuntimeException {

    private static final long serialVersionUID = 1L;

    private final String sqlState;
    private final boolean refused;

    MigrationFailedException(String message, String sqlState, boolean refused, Throwable cause) {
        super(message, cause);
        this.sqlState = sqlState;
        this.refused = refused;
    }

    /** The code of the database for the error, or null if the database gave none. */
    public String getSqlState() {
        return sqlState;
    }

    /** True if the text was no script that this library can read. Nothing was sent to the database then. */
    public boolean isRefused() {
        return refused;
    }
}
