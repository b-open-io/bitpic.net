import Link from "next/link";

export default function AboutPage() {
  return (
    <div className="container mx-auto max-w-3xl px-4 py-12 sm:px-6 lg:px-8">
      <article className="prose prose-neutral dark:prose-invert max-w-none">
        <h1 className="text-3xl font-bold tracking-tight">What is BitPic?</h1>

        <p>
          BitPic is a protocol for hosting and using Paymail avatars on the
          Bitcoin blockchain.
        </p>

        <p className="text-lg font-medium">
          You can think of it as{" "}
          <a
            href="https://en.gravatar.com/"
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary underline underline-offset-4"
          >
            Gravatar
          </a>
          , but for Bitcoin.
        </p>

        <ul className="space-y-2">
          <li>
            Instead of using a normal email address, BitPic uses{" "}
            <a
              href="https://bsvalias.org/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary underline underline-offset-4"
            >
              Paymail
            </a>{" "}
            address.
          </li>
          <li>
            Instead of storing the images on a proprietary server, it stores
            them on the Bitcoin blockchain.
          </li>
          <li>BitPic is open and distributed. Anyone can run a BitPic node.</li>
          <li>
            The images are 100% stored on the Bitcoin blockchain, signed by
            Paymail user identity public key. Images signed with invalid
            signature are not indexed.
          </li>
        </ul>

        <hr className="my-8 border-border" />

        <h2 className="text-2xl font-bold tracking-tight">
          Free @bitpic.net Paymail
        </h2>

        <p>
          BitPic.net provides free paymail addresses that include built-in
          avatar support. When you register a{" "}
          <code className="bg-muted px-1 py-0.5 font-mono text-sm">
            yourname@bitpic.net
          </code>{" "}
          paymail, you get:
        </p>

        <ul className="space-y-2">
          <li>
            <strong>BSV Payment Address:</strong> Receive Bitcoin payments to
            your memorable paymail address, forwarded to your Yours Wallet.
          </li>
          <li>
            <strong>Ordinals Receive:</strong> Accept 1Sat Ordinals NFTs
            directly to your paymail address.
          </li>
          <li>
            <strong>Avatar Capability:</strong> Your BitPic avatar is
            automatically served via the standard paymail public-profile
            capability (BRFC f12f968c92d6).
          </li>
          <li>
            <strong>Identity Verification:</strong> Your paymail is linked to
            your wallet&apos;s identity key, ensuring only you can update your
            avatar.
          </li>
        </ul>

        <p>
          <Link
            href="/paymail"
            className="text-primary underline underline-offset-4"
          >
            Register your free @bitpic.net paymail
          </Link>{" "}
          to get started.
        </p>

        <hr className="my-8 border-border" />

        <h2 className="text-2xl font-bold tracking-tight">
          Step 1. Upload avatar to Bitcoin
        </h2>

        <p>
          Create a Bitcoin transaction which uploads a signed image using the
          BitPic protocol.
        </p>

        <pre className="bg-muted p-4 overflow-x-auto font-mono text-sm">
          {`OP_0
OP_RETURN
19HxigV4QyBv3tHpQVcUEQyq1pzZVdoAut
  [FILE Binary]
  image/jpeg
  binary
|
18pAqbYqhzErT6Zk3a5dwxHtB9icv8jH2p
  [Paymail]
  [Pubkey]
  [Sig]`}
        </pre>

        <h2 className="text-2xl font-bold tracking-tight mt-8">Step 2. Use</h2>

        <p>
          Once uploaded, you can use the image from anywhere, simply by
          referencing:
        </p>

        <code className="bg-muted px-2 py-1 font-mono text-sm">
          https://bitpic.net/u/[Paymail]
        </code>

        <p className="mt-4">Here&apos;s an example:</p>

        <Link
          href="/u/644@moneybutton.com"
          className="block p-4 border border-border hover:bg-muted/50 transition-colors"
        >
          <code className="font-mono text-sm text-primary">
            https://bitpic.net/u/644@moneybutton.com
          </code>
          {/* biome-ignore lint/performance/noImgElement: Dynamic avatar URL from backend */}
          <img
            src="/u/644@moneybutton.com"
            alt="644@moneybutton.com avatar"
            className="mt-4 w-24 h-24 object-cover"
          />
        </Link>

        <h2 className="text-2xl font-bold tracking-tight mt-8">
          Step 3. Update
        </h2>

        <p>
          BitPic implements a mutable database. Whenever you upload a new
          avatar, your BitPic address will be updated to serve the newly
          uploaded avatar image.
        </p>

        <hr className="my-8 border-border" />

        <h2 className="text-2xl font-bold tracking-tight">Why use BitPic?</h2>

        <ol className="space-y-4">
          <li>
            <strong>Your avatar forever:</strong> Paymail providers and wallet
            providers may disappear, but your BitPic avatar will never go away
            because it&apos;s on the blockchain. If you post something tied to
            your Paymail, you probably want the avatar to show up forever.
          </li>
          <li>
            <strong>
              App developers: No need to roll your own avatar system:
            </strong>{" "}
            As an application developer, you don&apos;t need to build a user
            avatar system from scratch. Just start using the avatar by
            referencing{" "}
            <code className="bg-muted px-1 py-0.5 font-mono text-sm">
              https://bitpic.net/u/[Paymail]
            </code>
            ! If an avatar doesn&apos;t exist for that paymail address, you will
            instead see a default image.
          </li>
          <li>
            <strong>100% Open:</strong> BitPic is open source, which means
            anybody can run their own BitPic node to operate the avatar system.
          </li>
          <li>
            <strong>Interoperable and Permissionless:</strong> You don&apos;t
            need to ask other wallets or applications for permission to use
            their avatars tied to their paymails, because the avatars are served
            from the single source of truth: the Bitcoin blockchain.
          </li>
        </ol>

        <hr className="my-8 border-border" />

        <h2 className="text-2xl font-bold tracking-tight">How to use BitPic</h2>

        <h3 className="text-xl font-semibold mt-6">1. For users</h3>

        <p>
          Once you upload your avatar to the blockchain, you can use it from
          anywhere. For example you can embed your BitPic in your website simply
          with an HTML tag:
        </p>

        <code className="block bg-muted p-3 font-mono text-sm overflow-x-auto">
          {`<img src="https://bitpic.net/u/<YOUR_PAYMAIL>">`}
        </code>

        <h3 className="text-xl font-semibold mt-6">2. For app developers</h3>

        <p>
          <strong>No need to roll your own avatar system:</strong> Bitpic is an
          avatar owned by the user through Paymail. Outsource your Avatar system
          to the Bitcoin blockchain.
        </p>

        <p>
          <strong>Uploading Avatars:</strong> Allowing your users to upload
          avatars is easy. Send them to the{" "}
          <Link
            href="/upload"
            className="text-primary underline underline-offset-4"
          >
            BitPic upload interface
          </Link>
          .
        </p>

        <hr className="my-8 border-border" />

        <h2 className="text-2xl font-bold tracking-tight">API Endpoints</h2>

        <div className="space-y-4">
          <div className="p-4 bg-muted">
            <code className="font-mono text-sm font-semibold">
              GET /u/&lt;paymail&gt;
            </code>
            <p className="mt-2 text-muted-foreground">
              Returns the avatar image for the given paymail address. Can be
              embedded directly in apps.
            </p>
            <a
              href="/u/644@moneybutton.com"
              className="text-primary text-sm underline underline-offset-4"
            >
              Example: /u/644@moneybutton.com
            </a>
          </div>

          <div className="p-4 bg-muted">
            <code className="font-mono text-sm font-semibold">
              GET /api/exists/&lt;paymail&gt;
            </code>
            <p className="mt-2 text-muted-foreground">
              Returns JSON indicating if the paymail has an associated BitPic
              avatar.
            </p>
            <a
              href="/api/exists/644@moneybutton.com"
              className="text-primary text-sm underline underline-offset-4"
            >
              Example: /api/exists/644@moneybutton.com
            </a>
          </div>

          <div className="p-4 bg-muted">
            <code className="font-mono text-sm font-semibold">
              GET /api/avatar/&lt;paymail&gt;
            </code>
            <p className="mt-2 text-muted-foreground">
              Returns JSON metadata about the avatar including txid and
              timestamp.
            </p>
            <a
              href="/api/avatar/644@moneybutton.com"
              className="text-primary text-sm underline underline-offset-4"
            >
              Example: /api/avatar/644@moneybutton.com
            </a>
          </div>

          <div className="p-4 bg-muted">
            <code className="font-mono text-sm font-semibold">
              GET /api/feed
            </code>
            <p className="mt-2 text-muted-foreground">
              Returns the most recent BitPic uploads as JSON.
            </p>
            <a
              href="/api/feed"
              className="text-primary text-sm underline underline-offset-4"
            >
              Example: /api/feed
            </a>
          </div>
        </div>

        <hr className="my-8 border-border" />

        <h2 className="text-2xl font-bold tracking-tight">Default Image</h2>

        <p>
          By default BitPic returns a fixed default image if an image
          doesn&apos;t yet exist for the corresponding paymail address.
        </p>

        <p>
          You can specify your own default image by adding a{" "}
          <code className="bg-muted px-1 py-0.5 font-mono text-sm">
            d=&lt;default image url&gt;
          </code>{" "}
          parameter:
        </p>

        <code className="block bg-muted p-3 font-mono text-sm overflow-x-auto">
          https://bitpic.net/u/unknown@example.com?d=https://example.com/fallback.png
        </code>

        <hr className="my-8 border-border" />

        <h2 className="text-2xl font-bold tracking-tight">Protocol</h2>

        <p>
          BitPic uses the{" "}
          <a
            href="https://b.bitdb.network/"
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary underline underline-offset-4"
          >
            B protocol
          </a>{" "}
          for file storage and identifies avatars with the BitPic protocol
          prefix:
        </p>

        <div className="p-4 bg-muted space-y-2">
          <div>
            <span className="text-muted-foreground text-sm">B Protocol:</span>
            <code className="ml-2 font-mono text-sm">
              19HxigV4QyBv3tHpQVcUEQyq1pzZVdoAut
            </code>
          </div>
          <div>
            <span className="text-muted-foreground text-sm">
              BitPic Protocol:
            </span>
            <code className="ml-2 font-mono text-sm">
              18pAqbYqhzErT6Zk3a5dwxHtB9icv8jH2p
            </code>
          </div>
        </div>

        <p className="mt-4">
          View BitPic transactions on{" "}
          <a
            href="https://whatsonchain.com/search?q=18pAqbYqhzErT6Zk3a5dwxHtB9icv8jH2p"
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary underline underline-offset-4"
          >
            WhatsOnChain
          </a>
          .
        </p>
      </article>
    </div>
  );
}
