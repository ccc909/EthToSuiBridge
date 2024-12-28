module 0x0::IBT {
    use sui::coin::{Self, TreasuryCap};
    use sui::event;

    public struct IBT has drop {}

    public struct BridgeAuth has key {
        id: object::UID,
        treasury_cap: TreasuryCap<IBT>,
        admin: address
    }

    public struct MintEvent has copy, drop {
        recipient: address,
        amount: u64
    }

    public struct BurnEvent has copy, drop {
        burner: address,
        amount: u64
    }

    public struct BridgeEvent has copy, drop {
        sui_address: address,
        amount: u64,
        eth_address: vector<u8>, 
    }

    public entry fun burn_and_bridge(
        auth: &mut BridgeAuth,
        coin_to_burn: coin::Coin<IBT>, 
        eth_address: vector<u8>,       
        ctx: &mut tx_context::TxContext
    ) {
        let sender = tx_context::sender(ctx);
        let amount = sui::balance::value(coin::balance(&coin_to_burn));

        coin::burn(&mut auth.treasury_cap, coin_to_burn);

        event::emit(BridgeEvent {
            sui_address: sender,
            amount,
            eth_address,
        });
    }

    const E_NOT_AUTHORIZED: u64 = 0;

    fun init(witness: IBT, ctx: &mut tx_context::TxContext) {
        let (treasury_cap, metadata) = coin::create_currency(
            witness,
            9, 
            b"IBT", 
            b"Inter Blockchain Token", 
            b"A token that can be bridged between chains", 
            option::none(), 
            ctx
        );

        transfer::public_freeze_object(metadata);

        let sender = tx_context::sender(ctx);
        transfer::transfer(BridgeAuth {
            id: object::new(ctx),
            treasury_cap,
            admin: sender
        }, sender);
    }

    public entry fun mint(
        auth: &mut BridgeAuth,
        amount: u64,
        recipient: address,
        ctx: &mut tx_context::TxContext
    ) {
        assert!(tx_context::sender(ctx) == auth.admin, E_NOT_AUTHORIZED);

        let minted_coin = coin::mint(&mut auth.treasury_cap, amount, ctx);
        transfer::public_transfer(minted_coin, recipient);

        event::emit(MintEvent {
            recipient,
            amount
        });
    }

    public entry fun burn(
        auth: &mut BridgeAuth,
        amount: u64,
        ctx: &mut tx_context::TxContext
    ) {
        let coin_to_burn = coin::mint(&mut auth.treasury_cap, amount, ctx);
        let burner = tx_context::sender(ctx);

        coin::burn(&mut auth.treasury_cap, coin_to_burn);

        event::emit(BurnEvent {
            burner,
            amount
        });
    }

    public fun total_supply(auth: &BridgeAuth): u64 {
        coin::total_supply(&auth.treasury_cap)
    }

    #[test_only]
    public fun init_for_testing(ctx: &mut tx_context::TxContext) {
        init(IBT {}, ctx)
    }
}